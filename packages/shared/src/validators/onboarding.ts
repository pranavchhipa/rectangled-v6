import { z } from 'zod'

// Phase 1 — onboarding flow per organization type. Branches the wizard.
export const onboardingFlowSchema = z.enum(['direct', 'multi_location', 'agency'])

export const getOnboardingStateSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const updateOnboardingStepSchema = z.object({
  workspaceId: z.string().uuid(),
  step: z.number().int().min(0).max(10),
  data: z.record(z.unknown()).optional(),
})

export const completeOnboardingSchema = z.object({
  workspaceId: z.string().uuid(),
})

// Phase 1 Stage G — pick the flow before entering content steps.
export const setOnboardingFlowSchema = z.object({
  workspaceId: z.string().uuid(),
  flow: onboardingFlowSchema,
})
