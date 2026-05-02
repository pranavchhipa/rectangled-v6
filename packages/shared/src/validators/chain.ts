import { z } from 'zod'

/**
 * Phase 2 — chain rollup API validators.
 *
 * Hotfix §7 (workspace scope correction): all endpoints are now scoped
 * to a single `workspaceId`, not an `organizationId`. The previous
 * org-scoped behavior cross-mixed locations from sibling brands when
 * an agency owned multiple workspaces — wrong product semantics. A
 * workspace = one brand; a brand = one chain view.
 *
 * Every schema also accepts an optional `locationIds[]` filter so the
 * Dashboard's "By Location" filter dropdown can drill into a subset
 * without re-fetching.
 *
 * Membership: server-side `requireOrgWorkspaceAccess(workspaceId)` is
 * the gate. Read-only — any workspace member is allowed.
 */

const dateInput = z.union([z.string().datetime(), z.date()]).optional()
const optionalLocationIds = z.array(z.string().uuid()).optional()

export const chainOverviewSchema = z.object({
  workspaceId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
  locationIds: optionalLocationIds,
})

export const chainLeaderboardSchema = z.object({
  workspaceId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
  locationIds: optionalLocationIds,
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
  workspaceId: z.string().uuid(),
  locationIds: optionalLocationIds,
  dateFrom: dateInput,
  dateTo: dateInput,
  granularity: z.enum(['day', 'week', 'month']).default('day'),
})

export const chainGeoDistributionSchema = z.object({
  workspaceId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
  locationIds: optionalLocationIds,
})

export const chainResponseTimeHeatmapSchema = z.object({
  workspaceId: z.string().uuid(),
  dateFrom: dateInput,
  dateTo: dateInput,
  locationIds: optionalLocationIds,
})

export const chainEscalationLoadSchema = z.object({
  workspaceId: z.string().uuid(),
  locationIds: optionalLocationIds,
})
