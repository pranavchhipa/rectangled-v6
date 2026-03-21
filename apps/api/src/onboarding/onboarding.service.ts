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

  async complete(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

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
