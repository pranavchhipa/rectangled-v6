import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { onboardingState, workspaces, members } from '@rectangled/db'

@Injectable()
export class OnboardingService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async getState(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    let state = await this.db.query.onboardingState.findFirst({
      where: eq(onboardingState.workspaceId, workspaceId),
    })

    if (!state) {
      // Auto-create onboarding state
      const [created] = await this.db
        .insert(onboardingState)
        .values({ workspaceId })
        .returning()
      state = created
    }

    return state
  }

  async updateStep(workspaceId: string, step: number, userId: string) {
    await this.requireMembership(workspaceId, userId)

    let state = await this.db.query.onboardingState.findFirst({
      where: eq(onboardingState.workspaceId, workspaceId),
    })

    if (!state) {
      const [created] = await this.db
        .insert(onboardingState)
        .values({ workspaceId, currentStep: step })
        .returning()
      state = created
    }

    const completedSteps = [...new Set([...(state.completedSteps || []), step])]

    const [updated] = await this.db
      .update(onboardingState)
      .set({
        currentStep: step,
        completedSteps,
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.workspaceId, workspaceId))
      .returning()

    return updated
  }

  /**
   * Phase 1 Stage G — set the onboarding flow per organization type.
   * Idempotent; called from the wizard's flow-picker step.
   */
  async setFlow(
    workspaceId: string,
    flow: 'direct' | 'multi_location' | 'agency',
    userId: string,
  ) {
    await this.requireMembership(workspaceId, userId)

    let state = await this.db.query.onboardingState.findFirst({
      where: eq(onboardingState.workspaceId, workspaceId),
    })

    if (!state) {
      const [created] = await this.db
        .insert(onboardingState)
        .values({ workspaceId, flow })
        .returning()
      return created
    }

    const [updated] = await this.db
      .update(onboardingState)
      .set({ flow, updatedAt: new Date() })
      .where(eq(onboardingState.workspaceId, workspaceId))
      .returning()

    return updated
  }

  /**
   * Phase 2 — review-platform redirect URLs (hard requirement).
   *
   * Returns the URLs currently saved on workspace.settings.defaultRedirectLinks.
   * The wizard's Step 4 reads this on mount; missing platforms come back
   * undefined and the owner is prompted to paste a URL.
   */
  async getRedirectLinks(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })
    if (!workspace) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' })
    }

    const links = workspace.settings?.defaultRedirectLinks ?? {}
    return {
      google: links.google,
      zomato: links.zomato,
      swiggy: links.swiggy,
    }
  }

  /**
   * Phase 2 — persist the URLs the owner enabled in the wizard. Merges
   * into workspace.settings (not a wholesale replace) so the rest of
   * the settings shape (timezone, frequency caps, etc.) stays intact.
   */
  async setRedirectLinks(
    workspaceId: string,
    redirectLinks: { google?: string; zomato?: string; swiggy?: string },
    userId: string,
  ) {
    await this.requireMembership(workspaceId, userId)

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })
    if (!workspace) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' })
    }

    // Strip empty strings so absent keys mean "not configured" (rather
    // than "" which round-trips through the Zod URL validator anyway).
    const cleaned: { google?: string; zomato?: string; swiggy?: string } = {}
    if (redirectLinks.google) cleaned.google = redirectLinks.google
    if (redirectLinks.zomato) cleaned.zomato = redirectLinks.zomato
    if (redirectLinks.swiggy) cleaned.swiggy = redirectLinks.swiggy

    const newSettings = {
      ...workspace.settings,
      defaultRedirectLinks: cleaned,
    }

    await this.db
      .update(workspaces)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return { success: true, redirectLinks: cleaned }
  }

  async complete(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    // Phase 2 hard requirement — onboarding cannot complete unless at
    // least one redirect URL is set. Journey A Step 3a.1 has nowhere
    // to send the customer otherwise, breaking the happy-path silently.
    // Surface a friendly error pointing back to the wizard step.
    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })
    const links = workspace?.settings?.defaultRedirectLinks ?? {}
    const hasAnyUrl = !!(links.google || links.zomato || links.swiggy)
    if (!hasAnyUrl) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Add at least one review-platform URL (Google / Zomato / Swiggy) before finishing setup. Customers who click "Yes, leave a review" need somewhere to land.',
      })
    }

    // Mark onboarding state as complete
    await this.db
      .update(onboardingState)
      .set({ isComplete: true, updatedAt: new Date() })
      .where(eq(onboardingState.workspaceId, workspaceId))

    // Mark workspace as onboarding complete
    const [updated] = await this.db
      .update(workspaces)
      .set({ onboardingComplete: true, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
      .returning()

    return { success: true, workspace: updated }
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace' })
    }
    return membership
  }
}
