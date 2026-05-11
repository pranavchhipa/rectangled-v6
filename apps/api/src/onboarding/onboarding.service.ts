import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { onboardingState, workspaces, members } from '@rectangled/db'

/**
 * Phase 2.1 — Google Places review URL constructor.
 *
 * The deterministic "leave a review" URL for a Place ID. Google's docs
 * have shifted this format a few times; the `search.google.com/local/
 * writereview?placeid=` variant has been stable since 2021 and is the
 * one Google's own "Get more reviews" share links use. If they ever
 * break it, this is the only place that knows about the format.
 */
function buildGoogleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name)
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
   *
   * Phase 2.1 — also accepts an optional `googlePlaceId` so the search
   * pick from Step 4 is stored for later use by the GBP connector flow.
   */
  async setRedirectLinks(
    workspaceId: string,
    redirectLinks: { google?: string; zomato?: string; swiggy?: string },
    userId: string,
    googlePlaceId?: string,
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
      ...(googlePlaceId
        ? { googlePlaceId }
        : workspace.settings?.googlePlaceId
          ? { googlePlaceId: workspace.settings.googlePlaceId }
          : {}),
    }

    await this.db
      .update(workspaces)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return { success: true, redirectLinks: cleaned, googlePlaceId }
  }

  /**
   * Phase 2.1 — Google Places API Text Search.
   *
   * Owner-typed business name → up to 5 candidate matches. Used by
   * onboarding Step 4 to derive the writereview URL deterministically
   * once the owner picks the right place.
   *
   * Pricing: Text Search is paid via Google Maps Platform. The $200/mo
   * free credit covers ~6,000 searches/mo, which is plenty for
   * onboarding-only invocation. If GOOGLE_API_KEY is missing, returns
   * an empty list so the wizard falls through to manual paste cleanly.
   */
  async searchGooglePlaces(
    workspaceId: string,
    query: string,
    userId: string,
  ): Promise<{
    results: Array<{
      placeId: string
      name: string
      formattedAddress: string
      reviewUrl: string
    }>
  }> {
    await this.requireMembership(workspaceId, userId)

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      this.logger.warn(
        'searchGooglePlaces called but GOOGLE_API_KEY is not set — returning empty list. Owner will fall back to manual URL paste.',
      )
      return { results: [] }
    }

    try {
      const url = new URL(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
      )
      url.searchParams.set('query', query)
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      if (!res.ok) {
        throw new Error(`Places API HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        status: string
        error_message?: string
        results?: Array<{
          place_id: string
          name: string
          formatted_address: string
        }>
      }

      if (data.status === 'ZERO_RESULTS') {
        return { results: [] }
      }
      if (data.status !== 'OK') {
        // Surface a friendly message; keep the upstream detail in logs.
        this.logger.warn(
          `Places API non-OK status: ${data.status} ${data.error_message ?? ''}`,
        )
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: `Google Places search is unavailable right now (${data.status}). You can paste the review URL manually.`,
        })
      }

      const results = (data.results ?? []).slice(0, 5).map((r) => ({
        placeId: r.place_id,
        name: r.name,
        formattedAddress: r.formatted_address,
        reviewUrl: buildGoogleReviewUrl(r.place_id),
      }))

      return { results }
    } catch (err) {
      if (err instanceof TRPCError) throw err
      this.logger.error(`searchGooglePlaces failed: ${(err as Error).message}`)
      throw new TRPCError({
        code: 'BAD_GATEWAY',
        message:
          'Could not reach Google Places. Try again, or paste the review URL manually.',
      })
    }
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
