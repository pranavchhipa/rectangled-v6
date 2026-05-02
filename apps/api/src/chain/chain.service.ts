import { Injectable, Inject, Logger } from '@nestjs/common'
import { eq, and, gte, lte, sql, desc, inArray } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  locations,
  reviews,
  reviewResponses,
  escalations,
} from '@rectangled/db'
import { requireOrgWorkspaceAccess } from '../auth/permissions'

/**
 * Phase 2 — chain rollup service.
 *
 * Hotfix §7 (workspace scope correction): every endpoint is now
 * scoped to a single workspaceId. Agency orgs with N brands had a
 * single chain view that cross-mixed all N — wrong. A workspace = one
 * brand; a brand has one chain view across its locations.
 *
 * Permission: `requireOrgWorkspaceAccess(workspaceId)` validates the
 * caller is a member of the org that owns this workspace AND has it in
 * their assigned scope (handles agency staff who can only see specific
 * client brands). Read-only — any role is allowed for these views.
 *
 * Date defaults: when from/to are omitted we default to "last 30 days".
 *
 * Optional `locationIds[]` filter: when supplied, queries scope to
 * just those locations (still gated on workspace membership). Empty or
 * undefined = all locations in the workspace.
 */

const DEFAULT_WINDOW_DAYS = 30

function resolveWindow(input: { dateFrom?: string | Date; dateTo?: string | Date }): {
  from: Date
  to: Date
} {
  const to = input.dateTo ? new Date(input.dateTo) : new Date()
  const from = input.dateFrom
    ? new Date(input.dateFrom)
    : new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return { from, to }
}

interface BaseInput {
  workspaceId: string
  locationIds?: string[]
  dateFrom?: string | Date
  dateTo?: string | Date
}

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name)
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * Resolve which location IDs are in scope for a given query.
   *   - If `input.locationIds` provided: use those (still must belong
   *     to the workspace — DB join enforces this).
   *   - Else: every location in the workspace.
   */
  private async resolveLocationIds(input: BaseInput): Promise<string[]> {
    const conds = [eq(locations.workspaceId, input.workspaceId)]
    if (input.locationIds && input.locationIds.length > 0) {
      conds.push(inArray(locations.id, input.locationIds))
    }
    const rows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(and(...conds))
    return rows.map((r) => r.id)
  }

  /**
   * Top-strip KPIs across the workspace (or a subset when locationIds
   * are passed).
   */
  async getOverviewKpis(input: BaseInput, userId: string) {
    await requireOrgWorkspaceAccess(this.db, userId, input.workspaceId)
    const { from, to } = resolveWindow(input)

    const locationIds = await this.resolveLocationIds(input)
    const locationCount = locationIds.length

    if (locationCount === 0) {
      return {
        locationCount: 0,
        totalReviews: 0,
        avgRating: 0,
        responseRate: 0,
        avgResponseMinutes: null as number | null,
        openEscalations: 0,
        slaBreachRate: 0,
        sentimentBreakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      }
    }

    const [reviewStats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        avgRating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 2)::float, 0)`,
        positive: sql<number>`count(*) filter (where ${reviews.sentiment} = 'positive')::int`,
        negative: sql<number>`count(*) filter (where ${reviews.sentiment} = 'negative')::int`,
        neutral: sql<number>`count(*) filter (where ${reviews.sentiment} = 'neutral')::int`,
        mixed: sql<number>`count(*) filter (where ${reviews.sentiment} = 'mixed')::int`,
      })
      .from(reviews)
      .where(
        and(
          inArray(reviews.locationId, locationIds),
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )

    // Response rate + avg response time. Joining reviews to their first
    // posted reviewResponses (status='posted'). avg minutes between
    // reviewedAt and postedAt.
    const [responseStats] = await this.db
      .select({
        respondedCount: sql<number>`count(distinct ${reviews.id}) filter (where ${reviewResponses.status} = 'posted')::int`,
        avgResponseMinutes: sql<number>`coalesce(round(avg(extract(epoch from (${reviewResponses.postedAt} - ${reviews.reviewedAt})) / 60) filter (where ${reviewResponses.status} = 'posted')::numeric, 0)::int, 0)`,
      })
      .from(reviews)
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(
        and(
          inArray(reviews.locationId, locationIds),
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )

    const total = reviewStats?.total ?? 0
    const responseRate =
      total > 0 ? Math.round(((responseStats?.respondedCount ?? 0) / total) * 100) : 0

    const [escStats] = await this.db
      .select({
        open: sql<number>`count(*) filter (where ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
        breached: sql<number>`count(*) filter (where ${escalations.slaBreached} = true)::int`,
        totalInWindow: sql<number>`count(*) filter (where ${escalations.createdAt} >= ${from} AND ${escalations.createdAt} <= ${to})::int`,
      })
      .from(escalations)
      .where(inArray(escalations.locationId, locationIds))

    const slaBreachRate =
      escStats && escStats.totalInWindow > 0
        ? Math.round((escStats.breached / escStats.totalInWindow) * 100)
        : 0

    return {
      locationCount,
      totalReviews: total,
      avgRating: reviewStats?.avgRating ?? 0,
      responseRate,
      avgResponseMinutes: responseStats?.avgResponseMinutes ?? null,
      openEscalations: escStats?.open ?? 0,
      slaBreachRate,
      sentimentBreakdown: {
        positive: reviewStats?.positive ?? 0,
        negative: reviewStats?.negative ?? 0,
        neutral: reviewStats?.neutral ?? 0,
        mixed: reviewStats?.mixed ?? 0,
      },
    }
  }

  /**
   * Per-location leaderboard. One row per location with stats.
   */
  async getLocationLeaderboard(
    input: BaseInput & {
      sortBy?: string
      sortDir?: 'asc' | 'desc'
    },
    userId: string,
  ) {
    await requireOrgWorkspaceAccess(this.db, userId, input.workspaceId)
    const { from, to } = resolveWindow(input)

    const wsLocationsQuery = this.db
      .select({
        id: locations.id,
        name: locations.name,
        city: locations.city,
        state: locations.state,
        workspaceId: locations.workspaceId,
      })
      .from(locations)
    const wsLocations = await (
      input.locationIds && input.locationIds.length > 0
        ? wsLocationsQuery.where(
            and(
              eq(locations.workspaceId, input.workspaceId),
              inArray(locations.id, input.locationIds),
            ),
          )
        : wsLocationsQuery.where(eq(locations.workspaceId, input.workspaceId))
    )

    const rows = await Promise.all(
      wsLocations.map(async (loc) => {
        const [revStats] = await this.db
          .select({
            count: sql<number>`count(*)::int`,
            avgRating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 2)::float, 0)`,
            positive: sql<number>`count(*) filter (where ${reviews.sentiment} = 'positive')::int`,
            negative: sql<number>`count(*) filter (where ${reviews.sentiment} = 'negative')::int`,
          })
          .from(reviews)
          .where(
            and(
              eq(reviews.locationId, loc.id),
              gte(reviews.reviewedAt, from),
              lte(reviews.reviewedAt, to),
            ),
          )

        const [respStats] = await this.db
          .select({
            responded: sql<number>`count(distinct ${reviews.id}) filter (where ${reviewResponses.status} = 'posted')::int`,
          })
          .from(reviews)
          .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
          .where(
            and(
              eq(reviews.locationId, loc.id),
              gte(reviews.reviewedAt, from),
              lte(reviews.reviewedAt, to),
            ),
          )

        const [escStats] = await this.db
          .select({
            open: sql<number>`count(*) filter (where ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
            breachedInWindow: sql<number>`count(*) filter (where ${escalations.slaBreached} = true AND ${escalations.createdAt} >= ${from} AND ${escalations.createdAt} <= ${to})::int`,
            totalInWindow: sql<number>`count(*) filter (where ${escalations.createdAt} >= ${from} AND ${escalations.createdAt} <= ${to})::int`,
          })
          .from(escalations)
          .where(eq(escalations.locationId, loc.id))

        const reviewCount = revStats?.count ?? 0
        const responseRate =
          reviewCount > 0
            ? Math.round(((respStats?.responded ?? 0) / reviewCount) * 100)
            : 0
        const slaBreachRate =
          escStats && escStats.totalInWindow > 0
            ? Math.round((escStats.breachedInWindow / escStats.totalInWindow) * 100)
            : 0

        const totalSentimented =
          (revStats?.positive ?? 0) + (revStats?.negative ?? 0)
        const sentimentNet =
          totalSentimented > 0
            ? Math.round(
                (((revStats?.positive ?? 0) - (revStats?.negative ?? 0)) /
                  totalSentimented) *
                  100,
              )
            : 0

        return {
          locationId: loc.id,
          locationName: loc.name,
          city: loc.city,
          state: loc.state,
          workspaceId: loc.workspaceId,
          reviews: reviewCount,
          avgRating: revStats?.avgRating ?? 0,
          sentimentNet,
          responseRate,
          openEscalations: escStats?.open ?? 0,
          slaBreachRate,
        }
      }),
    )

    const sortBy = input.sortBy ?? 'reviews'
    const sortDir = input.sortDir ?? 'desc'
    const dir = sortDir === 'asc' ? 1 : -1
    const sortField = (r: (typeof rows)[number]): number => {
      switch (sortBy) {
        case 'avgRating':
          return r.avgRating
        case 'sentiment':
          return r.sentimentNet
        case 'responseRate':
          return r.responseRate
        case 'openEscalations':
          return r.openEscalations
        case 'slaBreach':
          return r.slaBreachRate
        case 'reviews':
        default:
          return r.reviews
      }
    }
    rows.sort((a, b) => (sortField(a) - sortField(b)) * dir)
    return rows
  }

  /**
   * Multi-line trend data. One series per location (top N by review count
   * when locationIds is empty).
   */
  async getRatingTrendsByLocation(
    input: BaseInput & { granularity: 'day' | 'week' | 'month' },
    userId: string,
  ) {
    await requireOrgWorkspaceAccess(this.db, userId, input.workspaceId)
    const { from, to } = resolveWindow(input)

    let locationIds = input.locationIds ?? []
    if (locationIds.length === 0) {
      const top = await this.db
        .select({ id: locations.id })
        .from(reviews)
        .innerJoin(locations, eq(locations.id, reviews.locationId))
        .where(
          and(
            eq(locations.workspaceId, input.workspaceId),
            gte(reviews.reviewedAt, from),
            lte(reviews.reviewedAt, to),
          ),
        )
        .groupBy(locations.id)
        .orderBy(desc(sql`count(*)`))
        .limit(10)
      locationIds = top.map((t) => t.id)
    }

    if (locationIds.length === 0) return []

    const truncUnit =
      input.granularity === 'month'
        ? 'month'
        : input.granularity === 'week'
          ? 'week'
          : 'day'

    const rows = await this.db
      .select({
        locationId: reviews.locationId,
        locationName: locations.name,
        bucket: sql<string>`date_trunc(${truncUnit}, ${reviews.reviewedAt})::date::text`,
        avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .innerJoin(locations, eq(locations.id, reviews.locationId))
      .where(
        and(
          inArray(reviews.locationId, locationIds),
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )
      .groupBy(
        reviews.locationId,
        locations.name,
        sql`date_trunc(${truncUnit}, ${reviews.reviewedAt})`,
      )
      .orderBy(reviews.locationId, sql`date_trunc(${truncUnit}, ${reviews.reviewedAt})`)

    const seriesMap = new Map<
      string,
      {
        locationId: string
        name: string
        points: { date: string; avgRating: number; count: number }[]
      }
    >()
    for (const r of rows) {
      if (!r.locationId) continue
      let series = seriesMap.get(r.locationId)
      if (!series) {
        series = { locationId: r.locationId, name: r.locationName ?? '', points: [] }
        seriesMap.set(r.locationId, series)
      }
      series.points.push({ date: r.bucket, avgRating: r.avgRating, count: r.count })
    }
    return [...seriesMap.values()]
  }

  /**
   * Geographic distribution — pin per location.
   */
  async getGeoDistribution(input: BaseInput, userId: string) {
    await requireOrgWorkspaceAccess(this.db, userId, input.workspaceId)
    const { from, to } = resolveWindow(input)

    const wsLocationsQuery = this.db
      .select({
        id: locations.id,
        name: locations.name,
        city: locations.city,
        state: locations.state,
      })
      .from(locations)
    const wsLocations = await (
      input.locationIds && input.locationIds.length > 0
        ? wsLocationsQuery.where(
            and(
              eq(locations.workspaceId, input.workspaceId),
              inArray(locations.id, input.locationIds),
            ),
          )
        : wsLocationsQuery.where(eq(locations.workspaceId, input.workspaceId))
    )

    const rows = await Promise.all(
      wsLocations.map(async (loc) => {
        const [stats] = await this.db
          .select({
            count: sql<number>`count(*)::int`,
            avgRating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 2)::float, 0)`,
            positive: sql<number>`count(*) filter (where ${reviews.sentiment} = 'positive')::int`,
            negative: sql<number>`count(*) filter (where ${reviews.sentiment} = 'negative')::int`,
          })
          .from(reviews)
          .where(
            and(
              eq(reviews.locationId, loc.id),
              gte(reviews.reviewedAt, from),
              lte(reviews.reviewedAt, to),
            ),
          )

        const totalSent = (stats?.positive ?? 0) + (stats?.negative ?? 0)
        const sentimentNet =
          totalSent > 0
            ? Math.round((((stats?.positive ?? 0) - (stats?.negative ?? 0)) / totalSent) * 100)
            : 0

        return {
          locationId: loc.id,
          name: loc.name,
          city: loc.city,
          state: loc.state,
          // Lat/lng aren't on locations yet; UI groups by city/state for now.
          lat: null as number | null,
          lng: null as number | null,
          reviewCount: stats?.count ?? 0,
          avgRating: stats?.avgRating ?? 0,
          sentimentNet,
        }
      }),
    )
    return rows
  }

  /**
   * Response-time heatmap: bucket reviews by their reviewedAt's day-of-week
   * and hour-of-day; report avg minutes-to-first-reply per bucket.
   */
  async getResponseTimeHeatmap(input: BaseInput, userId: string) {
    await requireOrgWorkspaceAccess(this.db, userId, input.workspaceId)
    const { from, to } = resolveWindow(input)

    const locationIds = await this.resolveLocationIds(input)
    if (locationIds.length === 0) return []

    const rows = await this.db
      .select({
        dayOfWeek: sql<number>`extract(dow from ${reviews.reviewedAt})::int`,
        hour: sql<number>`extract(hour from ${reviews.reviewedAt})::int`,
        avgResponseMinutes: sql<number>`coalesce(round(avg(extract(epoch from (${reviewResponses.postedAt} - ${reviews.reviewedAt})) / 60)::numeric, 0)::int, 0)`,
        count: sql<number>`count(distinct ${reviews.id}) filter (where ${reviewResponses.status} = 'posted')::int`,
      })
      .from(reviews)
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(
        and(
          inArray(reviews.locationId, locationIds),
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )
      .groupBy(
        sql`extract(dow from ${reviews.reviewedAt})`,
        sql`extract(hour from ${reviews.reviewedAt})`,
      )

    return rows
  }

  /**
   * Per-location open escalation count snapshot.
   */
  async getEscalationLoad(
    input: { workspaceId: string; locationIds?: string[] },
    userId: string,
  ) {
    await requireOrgWorkspaceAccess(this.db, userId, input.workspaceId)

    const wsLocsQuery = this.db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
    const wsLocs = await (
      input.locationIds && input.locationIds.length > 0
        ? wsLocsQuery.where(
            and(
              eq(locations.workspaceId, input.workspaceId),
              inArray(locations.id, input.locationIds),
            ),
          )
        : wsLocsQuery.where(eq(locations.workspaceId, input.workspaceId))
    )

    if (wsLocs.length === 0) return []
    const locationIds = wsLocs.map((l) => l.id)

    const rows = await this.db
      .select({
        locationId: escalations.locationId,
        open: sql<number>`count(*) filter (where ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
        slaBreached: sql<number>`count(*) filter (where ${escalations.slaBreached} = true AND ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
      })
      .from(escalations)
      .where(inArray(escalations.locationId, locationIds))
      .groupBy(escalations.locationId)

    const map = new Map(rows.map((r) => [r.locationId, r]))
    return wsLocs.map((loc) => {
      const row = map.get(loc.id)
      return {
        locationId: loc.id,
        locationName: loc.name,
        open: row?.open ?? 0,
        slaBreached: row?.slaBreached ?? 0,
      }
    })
  }
}
