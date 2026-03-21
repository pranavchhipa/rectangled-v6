import { z } from 'zod'

export const listTruformsSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
})

export const getTruformByIdSchema = z.object({
  id: z.string().uuid(),
})

export const createTruformSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  type: z.enum(['nps', 'csat', 'ces', 'custom']),
  config: z
    .object({
      questions: z.array(z.record(z.unknown())).default([]),
      branding: z.record(z.unknown()).default({}),
      thankYouMessage: z.string().default('Thank you for your feedback!'),
    })
    .optional(),
})

export const updateTruformSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  config: z
    .object({
      questions: z.array(z.record(z.unknown())).optional(),
      branding: z.record(z.unknown()).optional(),
      thankYouMessage: z.string().optional(),
    })
    .optional(),
})

export const deleteTruformSchema = z.object({
  id: z.string().uuid(),
})

export const activateTruformSchema = z.object({
  id: z.string().uuid(),
})

export const archiveTruformSchema = z.object({
  id: z.string().uuid(),
})

export const getPublicTruformSchema = z.object({
  slug: z.string(),
})

export const submitTruformResponseSchema = z.object({
  truformId: z.string().uuid(),
  score: z.number().int().optional(),
  answers: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
})

export const listTruformResponsesSchema = z.object({
  truformId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export const getTruformStatsSchema = z.object({
  truformId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})
