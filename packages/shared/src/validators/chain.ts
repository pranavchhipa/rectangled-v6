import { z } from 'zod'

/**
 * Phase 2 — chain rollup API validators.
 *
 * All endpoints are scoped to an organizationId and roll up across every
 * workspace/location in that org. Membership is checked via
 * requireOrgAccess on the server side.
 */

const dateInput = z.union([z.string().datetime(), z.date()]).optional()

export const chainOverviewSchema = z.object({
  organizationId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
})

export const chainLeaderboardSchema = z.object({
  organizationId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
  sortBy: z
    .enum([
      'reviews',
      'avgRating',
      'sentiment',
      'responseRate',
      'openEscalations',
      'slaBreach',
    ])
    .default('reviews')
    .optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc').optional(),
})

export const chainRatingTrendsSchema = z.object({
  organizationId: z.string().uuid(),
  locationIds: z.array(z.string().uuid()).optional(),
  dateFrom: dateInput,
  dateTo: dateInput,
  granularity: z.enum(['day', 'week', 'month']).default('day'),
})

export const chainGeoDistributionSchema = z.object({
  organizationId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
})

export const chainResponseTimeHeatmapSchema = z.object({
  organizationId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
})

export const chainEscalationLoadSchema = z.object({
  organizationId: z.string().uuid(),
})
