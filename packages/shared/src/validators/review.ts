import { z } from 'zod'
import { uuidSchema, paginationSchema } from './common'

export const listReviewsSchema = z
  .object({
    workspaceId: uuidSchema,
    locationId: uuidSchema.optional(),
    platform: z.string().max(50).optional(),
    minRating: z.coerce.number().int().min(1).max(5).optional(),
    maxRating: z.coerce.number().int().min(1).max(5).optional(),
    sentiment: z
      .enum(['positive', 'negative', 'neutral', 'mixed'])
      .optional(),
    source: z.enum(['online', 'offline']).optional(),
    search: z.string().max(200).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .merge(paginationSchema)

export const getReviewSchema = z.object({
  reviewId: uuidSchema,
})

export const syncReviewsSchema = z.object({
  connectorInstanceId: uuidSchema,
})

export const syncAllReviewsSchema = z.object({
  workspaceId: uuidSchema,
})

export const reviewStatsSchema = z.object({
  workspaceId: uuidSchema,
})

export const reviewAnalyticsSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema.optional(),
  dateRange: z.enum(['7d', '30d', '90d', 'custom']).default('30d'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  platform: z.string().max(50).optional(),
})

export const generateResponseSchema = z.object({
  reviewId: uuidSchema,
})

export const bulkGenerateResponsesSchema = z.object({
  reviewIds: z.array(uuidSchema).min(1).max(50),
})

export const approveResponseSchema = z.object({
  responseId: uuidSchema,
})

export const rejectResponseSchema = z.object({
  responseId: uuidSchema,
})

export const editResponseSchema = z.object({
  responseId: uuidSchema,
  content: z.string().min(1, 'Response cannot be empty').max(2000),
})

export const postResponseSchema = z.object({
  responseId: uuidSchema,
})

export const respondToReviewSchema = z.object({
  reviewId: uuidSchema,
  responseText: z.string().min(1, 'Response cannot be empty').max(2000),
})

export const deleteReviewReplySchema = z.object({
  reviewId: uuidSchema,
})
