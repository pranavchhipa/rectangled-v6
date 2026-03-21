import { z } from 'zod'
import { uuidSchema, paginationSchema } from './common'

export const getCurrentPlanSchema = z.object({
  workspaceId: uuidSchema,
})

export const listInvoicesSchema = z
  .object({
    workspaceId: uuidSchema,
  })
  .merge(paginationSchema)

export const createCheckoutSessionSchema = z.object({
  workspaceId: uuidSchema,
  plan: z.enum(['pro', 'enterprise']),
})

export const cancelSubscriptionSchema = z.object({
  workspaceId: uuidSchema,
})

export const handleWebhookSchema = z.object({
  event: z.string(),
  payload: z.record(z.unknown()),
  razorpaySignature: z.string().optional(),
})
