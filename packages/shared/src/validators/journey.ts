import { z } from 'zod'

export const listJourneysSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  includeArchived: z.boolean().optional(),
})

export const getJourneyByIdSchema = z.object({
  id: z.string().uuid(),
})

export const createJourneySchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  settings: z
    .object({
      positiveThreshold: z.number().int().min(1).max(5).default(4),
      enableCoupon: z.boolean().default(false),
      reviewPlatform: z.string().default('google'),
    })
    .optional(),
})

export const updateJourneySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  settings: z
    .object({
      positiveThreshold: z.number().int().min(1).max(5).optional(),
      enableCoupon: z.boolean().optional(),
      reviewPlatform: z.string().optional(),
    })
    .optional(),
})

export const deleteJourneySchema = z.object({
  id: z.string().uuid(),
})

export const archiveJourneySchema = z.object({
  id: z.string().uuid(),
})

const screenSchema = z.object({
  id: z.string().uuid().optional(),
  order: z.number().int(),
  screenType: z.enum([
    'rating',
    'aspects',
    'review_redirect',
    'feedback',
    'contact_collection',
    'thank_you',
    'nps',
    'csat',
    'ces',
  ]),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  config: z.record(z.unknown()).default({}),
  branchConditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.unknown().optional(),
        nextScreenId: z.string(),
      })
    )
    .default([]),
})

export const updateJourneyScreensSchema = z.object({
  journeyId: z.string().uuid(),
  screens: z.array(screenSchema),
})

export const getPublicJourneySchema = z.object({
  slug: z.string(),
})

export const submitJourneyResponseSchema = z.object({
  journeyId: z.string().uuid(),
  journeyScreenId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  sessionId: z.string(),
  responseData: z.record(z.unknown()),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
})
