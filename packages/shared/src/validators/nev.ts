import { z } from 'zod'

export const submitNevResponseSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  emotions: z.array(
    z.object({
      emotionId: z.string().uuid(),
      intensity: z.number().int().min(1).max(5),
    })
  ).min(1),
  source: z.enum(['active_survey', 'passive_nlp', 'journey']),
  reviewId: z.string().uuid().optional(),
  truformResponseId: z.string().uuid().optional(),
  journeyResponseId: z.string().uuid().optional(),
  rawText: z.string().optional(),
})

export const getNevAnalyticsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const getNevTrendsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const getEmotionDefinitionsSchema = z.object({})

export const analyzeNevTextSchema = z.object({
  workspaceId: z.string().uuid(),
  text: z.string().min(1),
  reviewId: z.string().uuid().optional(),
})
