import { z } from 'zod'

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
