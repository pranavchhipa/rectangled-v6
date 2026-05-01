import { Injectable, Inject, Logger } from '@nestjs/common'
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  workspaces,
  locations,
  reviews,
  reviewResponses,
  escalations,
} from '@rectangled/db'
import { requireOrgAccess } from '../auth/permissions'

/**
 * Phase 2 — chain rollup service.
 *
 * Every endpoint is scoped to an organizationId and aggregates across every
 * workspace + location in the org. Permission is verified via
 * requireOrgAccess (just being a member of the org is enough — read-only).
 *
 * Date defaults: when from/to are omitted, we default to "last 30 days".
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

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name)
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * Top-strip KPIs across every location in the org.
   */
  async getOverviewKpis(
    input: { organizationId: string; dateFrom?: string | Date; dateTo?: string | Date },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId)
    const { from, to } = resolveWindow(input)

    // Locations in the org.
    const orgLocations = await this.db
      .select({ id: locations.id })
      .from(locations)
      .innerJoin(workspaces, eq(workspaces.id, locations.workspaceId))
      .where(eq(workspaces.organizationId, input.organizationId))
    const locationCount = orgLocations.length
    const locationIds = orgLocations.map((l) => l.id)

    if (locationIds.length === 0) {
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
          sql`${reviews.locationId} = ANY(${locationIds})`,
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
          sql`${reviews.locationId} = ANY(${locationIds})`,
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )

    const total = reviewStats?.total ?? 0
    const responseRate =
      total > 0 ? Math.round(((responseStats?.respondedCount ?? 0) / total) * 100) : 0

    // Escalations.
    const [escStats] = await this.db
      .select({
        open: sql<number>`count(*) filter (where ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
        breached: sql<number>`count(*) filter (where ${escalations.slaBreached} = true)::int`,
        totalInWindow: sql<number>`count(*) filter (where ${escalations.createdAt} >= ${from} AND ${escalations.createdAt} <= ${to})::int`,
      })
      .from(escalations)
      .where(sql`${escalations.locationId} = ANY(${locationIds})`)

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
    input: {
      organizationId: string
      dateFrom?: string | Date
      dateTo?: string | Date
      sortBy?: string
      sortDir?: 'asc' | 'desc'
    },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId)
    const { from, to } = resolveWindow(input)

    const orgLocations = await this.db
      .select({
        id: locations.id,
        name: locations.name,
        city: locations.city,
        state: locations.state,
        workspaceId: locations.workspaceId,
      })
      .from(locations)
      .innerJoin(workspaces, eq(workspaces.id, locations.workspaceId))
      .where(eq(workspaces.organizationId, input.organizationId))

    const rows = await Promise.all(
      orgLocations.map(async (loc) => {
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

        // Simple sentiment net: (positive - negative) / total
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
          sentimentNet, // -100 to +100
          responseRate,
          openEscalations: escStats?.open ?? 0,
          slaBreachRate,
        }
      }),
    )

    // Sort. Default: reviews desc.
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
   * Multi-line trend data. One series per location (top N by review count).
   * granularity: 'day' | 'week' | 'month'.
   */
  async getRatingTrendsByLocation(
    input: {
      organizationId: string
      locationIds?: string[]
      dateFrom?: string | Date
      dateTo?: string | Date
      granularity: 'day' | 'week' | 'month'
    },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId)
    const { from, to } = resolveWindow(input)

    // Resolve which locations to include.
    let locationIds = input.locationIds ?? []
    if (locationIds.length === 0) {
      const top = await this.db
        .select({ id: locations.id })
        .from(reviews)
        .innerJoin(locations, eq(locations.id, reviews.locationId))
        .innerJoin(workspaces, eq(workspaces.id, locations.workspaceId))
        .where(
          and(
            eq(workspaces.organizationId, input.organizationId),
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
          sql`${reviews.locationId} = ANY(${locationIds})`,
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )
      .groupBy(reviews.locationId, locations.name, sql`date_trunc(${truncUnit}, ${reviews.reviewedAt})`)
      .orderBy(reviews.locationId, sql`date_trunc(${truncUnit}, ${reviews.reviewedAt})`)

    // Group into series.
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
  async getGeoDistribution(
    input: { organizationId: string; dateFrom?: string | Date; dateTo?: string | Date },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId)
    const { from, to } = resolveWindow(input)

    const orgLocations = await this.db
      .select({
        id: locations.id,
        name: locations.name,
        city: locations.city,
        state: locations.state,
      })
      .from(locations)
      .innerJoin(workspaces, eq(workspaces.id, locations.workspaceId))
      .where(eq(workspaces.organizationId, input.organizationId))

    const rows = await Promise.all(
      orgLocations.map(async (loc) => {
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
          // Lat/lng aren't on the locations table yet — schema gap; UI can
          // geocode the city/state client-side as a temporary measure, or
          // a future migration adds lat/lng columns.
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
   *
   * Returns one row per (day-of-week, hour-of-day) with count + avg.
   * Days: 0 (Sunday) – 6 (Saturday). Hours: 0–23.
   */
  async getResponseTimeHeatmap(
    input: { organizationId: string; dateFrom?: string | Date; dateTo?: string | Date },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId)
    const { from, to } = resolveWindow(input)

    const orgLocs = await this.db
      .select({ id: locations.id })
      .from(locations)
      .innerJoin(workspaces, eq(workspaces.id, locations.workspaceId))
      .where(eq(workspaces.organizationId, input.organizationId))
    const locationIds = orgLocs.map((l) => l.id)
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
          sql`${reviews.locationId} = ANY(${locationIds})`,
          gte(reviews.reviewedAt, from),
          lte(reviews.reviewedAt, to),
        ),
      )
      .groupBy(sql`extract(dow from ${reviews.reviewedAt})`, sql`extract(hour from ${reviews.reviewedAt})`)

    return rows
  }

  /**
   * Per-location open escalation count snapshot. Cheap to compute, used by
   * the chain dashboard's leaderboard color-coding.
   */
  async getEscalationLoad(input: { organizationId: string }, userId: string) {
    await requireOrgAccess(this.db, userId, input.organizationId)

    const orgLocs = await this.db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .innerJoin(workspaces, eq(workspaces.id, locations.workspaceId))
      .where(eq(workspaces.organizationId, input.organizationId))

    if (orgLocs.length === 0) return []
    const locationIds = orgLocs.map((l) => l.id)

    const rows = await this.db
      .select({
        locationId: escalations.locationId,
        open: sql<number>`count(*) filter (where ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
        slaBreached: sql<number>`count(*) filter (where ${escalations.slaBreached} = true AND ${escalations.status} IN ('open', 'in_progress', 'paused'))::int`,
      })
      .from(escalations)
      .where(sql`${escalations.locationId} = ANY(${locationIds})`)
      .groupBy(escalations.locationId)

    const map = new Map(rows.map((r) => [r.locationId, r]))
    return orgLocs.map((loc) => {
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
