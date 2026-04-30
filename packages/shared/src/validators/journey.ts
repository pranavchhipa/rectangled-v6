import { z } from 'zod'

export const journeyMetricSchema = z.enum(['csat', 'nps', 'ces', 'nev', 'cli'])
export const reviewPlatformSchema = z.enum(['google', 'zomato', 'swiggy'])

/**
 * v2 journey settings — strict shape. No v1 fields accepted.
 */
const journeySettingsSchema = z
  .object({
    enabledMetrics: z.array(journeyMetricSchema).min(1).optional(),
    thresholds: z
      .object({
        csat: z.number().optional(),
        nps: z.number().optional(),
        ces: z.number().optional(),
        nev: z.number().optional(),
        cli: z.number().optional(),
      })
      .optional(),
    enableCoupon: z.boolean().optional(),
    reviewPlatform: reviewPlatformSchema.optional(),
  })
  .strict()

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
  settings: journeySettingsSchema.optional(),
})

export const updateJourneySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  locationId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  settings: journeySettingsSchema.optional(),
})

export const deleteJourneySchema = z.object({
  id: z.string().uuid(),
})

export const archiveJourneySchema = z.object({
  id: z.string().uuid(),
})

/**
 * v2: only `metric_question` screens are allowed. The DB enum still carries
 * the legacy values so existing rows don't break, but the API refuses to
 * write anything else.
 */
const screenSchema = z.object({
  id: z.string().uuid().optional(),
  order: z.number().int(),
  screenType: z.literal('metric_question'),
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
      }),
    )
    .default([]),
})

export const updateJourneyScreensSchema = z.object({
  journeyId: z.string().uuid(),
  screens: z.array(screenSchema).max(1, 'Journeys may only have one metric_question screen'),
})

export const getPublicJourneySchema = z.object({
  slug: z.string(),
})

/**
 * v2 response data shape. `metricShown` + `metricScore` are required on first
 * submit; on follow-up (with `updateResponseId`) they're optional because the
 * server merges into the existing row.
 */
const responseDataSchema = z
  .object({
    metricShown: journeyMetricSchema.optional(),
    metricScore: z.number().optional(),

    // Per-metric mirrored writes for analytics back-compat.
    csatScore: z.number().optional(),
    npsScore: z.number().optional(),
    cesScore: z.number().optional(),
    nevScore: z.number().optional(),
    cliScore: z.number().optional(),

    // Unhappy-path fields
    aspectTags: z.array(z.string()).optional(),
    feedback: z.string().optional(),

    // Happy-path fields
    acceptedReviewPrompt: z.boolean().optional(),
    redirectedTo: reviewPlatformSchema.optional(),
  })
  .strict()

export const submitJourneyResponseSchema = z.object({
  journeyId: z.string().uuid(),
  journeyScreenId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  sessionId: z.string(),
  responseData: responseDataSchema,
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  /**
   * v2 two-phase submit: first call inserts a row, second call merges
   * follow-up fields into the same row by passing `updateResponseId`.
   */
  updateResponseId: z.string().uuid().optional(),
})
