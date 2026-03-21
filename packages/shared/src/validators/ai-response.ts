import { z } from 'zod'
import { uuidSchema, paginationSchema } from './common'

export const listScheduledSchema = z
  .object({
    workspaceId: uuidSchema,
    status: z
      .enum(['pending', 'processing', 'completed', 'failed', 'cancelled'])
      .optional(),
  })
  .merge(paginationSchema)

export const generateAiResponseSchema = z.object({
  reviewId: uuidSchema,
})

export const scheduleResponseSchema = z.object({
  reviewId: uuidSchema,
  scheduledFor: z.coerce.date(),
})

export const cancelScheduleSchema = z.object({
  scheduleId: uuidSchema,
})

export const getAiSettingsSchema = z.object({
  workspaceId: uuidSchema,
})

export const updateAiSettingsSchema = z.object({
  workspaceId: uuidSchema,
  enabled: z.boolean().optional(),
  dailyLimit: z.coerce.number().int().min(1).max(500).optional(),
  minDelayMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  maxDelayMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  tone: z.enum(['professional', 'friendly', 'empathetic', 'witty']).optional(),
})

export const getDailyCountsSchema = z.object({
  locationId: uuidSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
})
