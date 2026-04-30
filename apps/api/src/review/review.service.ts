import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, gte, lte, like, or, sql, desc, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  reviews,
  reviewResponses,
  connectorInstances,
  members,
  workspaces,
  locations,
} from '@rectangled/db'
import { hasPermission } from '@rectangled/shared'
import type { Role } from '@rectangled/shared'
import { GbpAdapter, gbpStarRatingToNumber } from '../connector/adapters/gbp.adapter'
import { ZomatoAdapter } from '../connector/adapters/zomato.adapter'
import { AIResponseService } from './ai-response.service'
import { ConnectorService } from '../connector/connector.service'

@Injectable()
export class ReviewService {
  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly gbpAdapter: GbpAdapter,
    private readonly zomatoAdapter: ZomatoAdapter,
    private readonly aiResponseService: AIResponseService,
    private readonly connectorService: ConnectorService
  ) {}

  /**
   * Sync reviews from a connector instance (GBP) — with permission check.
   */
  async syncReviews(connectorInstanceId: string, userId: string) {
    const instance =
      await this.connectorService.getInstanceByIdInternal(connectorInstanceId)

    const membership = await this.requireMembership(
      instance.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:view')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to sync reviews',
      })
    }

    return this.performSync(instance)
  }

  /**
   * Sync reviews — no permission check (for cron/internal use).
   */
  async syncReviewsInternal(connectorInstanceId: string) {
    const instance =
      await this.connectorService.getInstanceByIdInternal(connectorInstanceId)
    return this.performSync(instance)
  }

  /**
   * Sync all connected connector instances (GBP + Zomato) for a workspace.
   */
  async syncAll(workspaceId: string, userId: string) {
    const membership = await this.requireMembership(workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'review:view')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to sync reviews',
      })
    }

    const instances = await this.db
      .select()
      .from(connectorInstances)
      .where(
        and(
          eq(connectorInstances.workspaceId, workspaceId),
          sql`${connectorInstances.connectorTypeId} IN ('gbp', 'zomato')`,
          eq(connectorInstances.status, 'connected')
        )
      )

    let totalSynced = 0
    let failures = 0

    for (const instance of instances) {
      try {
        const result = await this.performSync(instance)
        totalSynced += result.synced
      } catch {
        failures++
      }
    }

    return { synced: totalSynced, failures, total: instances.length }
  }

  /**
   * Core sync logic — shared by syncReviews, syncReviewsInternal, syncAll.
   */
  private async performSync(
    instance: typeof connectorInstances.$inferSelect
  ) {
    if (instance.connectorTypeId === 'zomato') {
      return this.performZomatoSync(instance)
    }

    if (instance.connectorTypeId !== 'gbp') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only GBP and Zomato connectors support review sync currently',
      })
    }

    const creds = instance.credentials as Record<string, string>
    if (!creds?.accessToken || !creds?.refreshToken) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Connector is missing OAuth credentials',
      })
    }

    // Refresh token if expired
    let accessToken = creds.accessToken
    if (creds.expiresAt && new Date(creds.expiresAt) <= new Date()) {
      const refreshed = await this.gbpAdapter.refreshAccessToken(
        creds.refreshToken
      )
      accessToken = refreshed.accessToken
      await this.connectorService.updateCredentials(instance.id, {
        ...creds,
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      })
    }

    // Fetch reviews from GBP (paginated)
    const config = instance.config as Record<string, string>
    let accountName = config?.accountName ?? ''
    let locationName = config?.locationName ?? ''

    // If we have a placeId but no accountName/locationName, resolve them
    if ((!accountName || !locationName) && config?.placeId) {
      const resolved = await this.gbpAdapter.findLocationByPlaceId(
        accessToken,
        config.placeId
      )
      if (resolved) {
        accountName = resolved.accountName
        locationName = resolved.locationName
        await this.connectorService.updateConfigInternal(
          instance.id,
          { accountName: resolved.accountName, locationName: resolved.locationName }
        ).catch(() => {})
      }
    }

    // Fallback: auto-discover first location from the authorized account
    if (!accountName || !locationName) {
      const discovered = await this.gbpAdapter.getFirstLocation(accessToken)
      if (discovered) {
        accountName = discovered.accountName
        locationName = discovered.locationName
        // Cache everything for future syncs
        await this.connectorService.updateConfigInternal(
          instance.id,
          {
            accountName: discovered.accountName,
            locationName: discovered.locationName,
            ...(discovered.placeId && { placeId: discovered.placeId }),
            ...(discovered.businessName && { businessName: discovered.businessName }),
          }
        ).catch(() => {})
      }
    }

    if (!accountName || !locationName) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Could not find any GBP locations for this account. Please ensure your Google account manages at least one business.',
      })
    }

    let synced = 0
    let pageToken: string | undefined

    do {
      const result = await this.gbpAdapter.fetchReviews(
        accessToken,
        accountName,
        locationName,
        pageToken
      )

      for (const gbpReview of result.reviews) {
        const rating = gbpStarRatingToNumber(gbpReview.starRating)

        // Check if review already exists
        const existing = await this.db
          .select({ id: reviews.id })
          .from(reviews)
          .where(
            and(
              eq(reviews.workspaceId, instance.workspaceId),
              eq(reviews.platform, 'google'),
              eq(reviews.platformReviewId, gbpReview.reviewId)
            )
          )
          .limit(1)

        if (existing.length === 0) {
          await this.db
            .insert(reviews)
            .values({
              workspaceId: instance.workspaceId,
              locationId: instance.locationId!,
              connectorInstanceId: instance.id,
              platform: 'google',
              platformReviewId: gbpReview.reviewId,
              reviewerName: gbpReview.reviewer.displayName,
              reviewerAvatarUrl: gbpReview.reviewer.profilePhotoUrl ?? null,
              rating,
              text: gbpReview.comment ?? null,
              reviewedAt: new Date(gbpReview.createTime),
              metadata: { gbpResourceName: gbpReview.name },
            })
            .onConflictDoNothing({
              target: [reviews.workspaceId, reviews.platform, reviews.platformReviewId],
            })
            .catch(() => {})

          synced++
        }
      }

      pageToken = result.nextPageToken
    } while (pageToken)

    // Update status + last sync time
    await this.connectorService.updateStatus(instance.id, 'connected')
    await this.db
      .update(connectorInstances)
      .set({ lastSyncAt: new Date() })
      .where(eq(connectorInstances.id, instance.id))

    return { synced }
  }

  /**
   * List reviews with pagination and filters.
   */
  async list(
    input: {
      workspaceId: string
      locationId?: string
      platform?: string
      source?: 'online' | 'offline'
      minRating?: number
      maxRating?: number
      sentiment?: string
      search?: string
      dateFrom?: Date
      dateTo?: Date
      page?: number
      limit?: number
    },
    userId: string
  ) {
    const membership = await this.requireMembership(
      input.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:view')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view reviews',
      })
    }

    const page = input.page ?? 1
    const limit = Math.min(input.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const conditions = [eq(reviews.workspaceId, input.workspaceId)]

    if (input.locationId) {
      conditions.push(eq(reviews.locationId, input.locationId))
    }
    if (input.platform) {
      conditions.push(eq(reviews.platform, input.platform))
    }
    if (input.minRating) {
      conditions.push(gte(reviews.rating, input.minRating))
    }
    if (input.maxRating) {
      conditions.push(lte(reviews.rating, input.maxRating))
    }
    if (input.sentiment) {
      conditions.push(eq(reviews.sentiment, input.sentiment))
    }
    if (input.source) {
      conditions.push(eq(reviews.source, input.source))
    }
    if (input.search) {
      conditions.push(
        or(
          like(reviews.text, `%${input.search}%`),
          like(reviews.reviewerName, `%${input.search}%`)
        )!
      )
    }
    if (input.dateFrom) {
      conditions.push(gte(reviews.reviewedAt, input.dateFrom))
    }
    if (input.dateTo) {
      conditions.push(lte(reviews.reviewedAt, input.dateTo))
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.reviewedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(where),
    ])

    const total = countResult[0]?.count ?? 0

    // Fetch location names for the reviews
    const locationIds = [...new Set(data.map((r: any) => r.locationId).filter(Boolean))] as string[]
    const locationNames: Map<string, string> = new Map()
    if (locationIds.length > 0) {
      const locs = await this.db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(sql`${locations.id} IN (${sql.join(locationIds.map(id => sql`${id}`), sql`, `)})`)
      for (const loc of locs) {
        locationNames.set(loc.id, loc.name)
      }
    }

    // Fetch latest response for each review
    const reviewIds = data.map((r) => r.id)
    let responsesMap: Map<string, typeof reviewResponses.$inferSelect> =
      new Map()

    if (reviewIds.length > 0) {
      const responses = await this.db
        .select()
        .from(reviewResponses)
        .where(
          sql`${reviewResponses.reviewId} IN ${reviewIds}`
        )
        .orderBy(desc(reviewResponses.createdAt))

      for (const resp of responses) {
        if (!responsesMap.has(resp.reviewId)) {
          responsesMap.set(resp.reviewId, resp)
        }
      }
    }

    return {
      data: data.map((r) => ({
        ...r,
        locationName: r.locationId ? locationNames.get(r.locationId) ?? null : null,
        latestResponse: responsesMap.get(r.id) ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get a single review by ID with all responses.
   */
  async getById(reviewId: string, userId: string) {
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    await this.requireMembership(review.workspaceId, userId)

    const responses = await this.db
      .select()
      .from(reviewResponses)
      .where(eq(reviewResponses.reviewId, reviewId))
      .orderBy(desc(reviewResponses.createdAt))

    return { ...review, responses }
  }

  /**
   * Get aggregate review stats for a workspace.
   */
  async getStats(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const [result] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
        positive: sql<number>`count(*) filter (where ${reviews.sentiment} = 'positive')::int`,
        negative: sql<number>`count(*) filter (where ${reviews.sentiment} = 'negative')::int`,
        neutral: sql<number>`count(*) filter (where ${reviews.sentiment} = 'neutral')::int`,
        responded: sql<number>`count(distinct ${reviewResponses.reviewId})::int`,
        onlineCount: sql<number>`count(*) filter (where ${reviews.source} = 'online')::int`,
        offlineCount: sql<number>`count(*) filter (where ${reviews.source} = 'offline')::int`,
      })
      .from(reviews)
      .leftJoin(reviewResponses, eq(reviews.id, reviewResponses.reviewId))
      .where(eq(reviews.workspaceId, workspaceId))

    const total = result?.total ?? 0

    return {
      totalReviews: total,
      averageRating: result?.avgRating ?? 0,
      onlineCount: result?.onlineCount ?? 0,
      offlineCount: result?.offlineCount ?? 0,
      sentimentBreakdown: {
        positive: result?.positive ?? 0,
        negative: result?.negative ?? 0,
        neutral: result?.neutral ?? 0,
      },
      responseRate:
        total > 0
          ? Math.round(((result?.responded ?? 0) / total) * 100)
          : 0,
    }
  }

  /**
   * Get analytics data for charts.
   */
  async getAnalytics(
    input: {
      workspaceId: string
      locationId?: string
      dateRange?: string
      dateFrom?: Date
      dateTo?: Date
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const { startDate, endDate } = this.resolveDateRange(input)
    const conditions: ReturnType<typeof eq>[] = [
      eq(reviews.workspaceId, input.workspaceId),
    ]
    if (startDate) conditions.push(gte(reviews.reviewedAt, startDate))
    if (endDate) conditions.push(lte(reviews.reviewedAt, endDate))
    if (input.locationId) {
      conditions.push(eq(reviews.locationId, input.locationId))
    }
    const where = and(...conditions)

    const [
      ratingDistribution,
      reviewVelocity,
      sentimentBreakdown,
      platformComparison,
      ratingTrend,
      responseRateResult,
      topThemes,
      overallStats,
    ] = await Promise.all([
      // 1. Rating distribution
      this.db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.rating)
        .orderBy(reviews.rating),

      // 2. Review velocity (by day)
      this.db
        .select({
          date: sql<string>`date_trunc('day', ${reviews.reviewedAt})::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(where)
        .groupBy(sql`date_trunc('day', ${reviews.reviewedAt})`)
        .orderBy(sql`date_trunc('day', ${reviews.reviewedAt})`),

      // 3. Sentiment breakdown
      this.db
        .select({
          sentiment: reviews.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.sentiment),

      // 4. Platform comparison
      this.db
        .select({
          platform: reviews.platform,
          count: sql<number>`count(*)::int`,
          avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.platform),

      // 5. Rating trend
      this.db
        .select({
          date: sql<string>`date_trunc('day', ${reviews.reviewedAt})::date::text`,
          avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
        })
        .from(reviews)
        .where(where)
        .groupBy(sql`date_trunc('day', ${reviews.reviewedAt})`)
        .orderBy(sql`date_trunc('day', ${reviews.reviewedAt})`),

      // 6. Response rate
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          responded: sql<number>`count(distinct ${reviewResponses.reviewId})::int`,
        })
        .from(reviews)
        .leftJoin(
          reviewResponses,
          and(
            eq(reviews.id, reviewResponses.reviewId),
            sql`${reviewResponses.status} IN ('approved', 'posted')`
          )
        )
        .where(where),

      // 7. Top themes
      this.db
        .select({
          theme: sql<string>`unnest(${reviews.themes})`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(
          and(
            ...conditions,
            sql`${reviews.themes} IS NOT NULL AND array_length(${reviews.themes}, 1) > 0`
          )
        )
        .groupBy(sql`unnest(${reviews.themes})`)
        .orderBy(sql`count(*) DESC`)
        .limit(20),

      // 8. Overall stats for health score
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
          positiveCount: sql<number>`count(*) filter (where ${reviews.sentiment} = 'positive')::int`,
        })
        .from(reviews)
        .where(where),
    ])

    // Compute Health Score (0-100)
    const total = overallStats[0]?.total ?? 0
    const avgRating = overallStats[0]?.avgRating ?? 0
    const positiveCount = overallStats[0]?.positiveCount ?? 0
    const respondedCount = responseRateResult[0]?.responded ?? 0
    const respRate = total > 0 ? respondedCount / total : 0
    const sentimentRatio = total > 0 ? positiveCount / total : 0
    const ratingScore = (avgRating - 1) / 4
    const volumeScore = Math.min(Math.log10(total + 1) / 2, 1)
    const healthScore = Math.round(
      ratingScore * 30 + respRate * 25 + sentimentRatio * 25 + volumeScore * 20
    )

    return {
      ratingDistribution,
      reviewVelocity,
      sentimentBreakdown: sentimentBreakdown.filter((s) => s.sentiment),
      platformComparison,
      ratingTrend,
      responseRate: {
        total: responseRateResult[0]?.total ?? 0,
        responded: respondedCount,
        rate: total > 0 ? Math.round(respRate * 100) : 0,
      },
      topThemes,
      healthScore,
      dateRange: { from: startDate, to: endDate },
    }
  }

  /**
   * Generate an AI response for a review.
   */
  async generateResponse(reviewId: string, userId: string) {
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to respond to reviews',
      })
    }

    // Fetch workspace + location for AI context
    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, review.workspaceId),
    })
    const location = review.locationId
      ? await this.db.query.locations.findFirst({
          where: eq(locations.id, review.locationId),
        })
      : null

    if (!workspace || !location) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Missing workspace or location data',
      })
    }

    const aiResult = await this.aiResponseService.generateResponse(
      {
        reviewerName: review.reviewerName,
        rating: review.rating,
        text: review.text,
        platform: review.platform,
      },
      {
        name: workspace.name,
        industry: workspace.industry,
        tonePreset: workspace.tonePreset ?? null,
      },
      {
        name: location.name,
        city: location.city,
      }
    )

    // Save as draft response
    const [response] = await this.db
      .insert(reviewResponses)
      .values({
        reviewId,
        content: aiResult.content,
        status: 'draft',
        generatedBy: 'ai',
        aiModel: aiResult.model,
        metadata: { tokensUsed: aiResult.tokensUsed },
      })
      .returning()

    return response
  }

  /**
   * Bulk generate AI responses for multiple reviews.
   */
  async bulkGenerateResponses(reviewIds: string[], userId: string) {
    if (reviewIds.length === 0) {
      return { total: 0, succeeded: 0, failed: 0, results: [] }
    }

    // Permission check via first review
    const firstReview = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewIds[0]),
    })
    if (!firstReview) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' })
    }

    const membership = await this.requireMembership(
      firstReview.workspaceId,
      userId
    )
    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to respond to reviews',
      })
    }

    const results: Array<{ reviewId: string; success: boolean; error?: string }> = []

    for (const reviewId of reviewIds) {
      try {
        await this.generateResponse(reviewId, userId)
        results.push({ reviewId, success: true })
      } catch (err: any) {
        results.push({ reviewId, success: false, error: err.message })
      }
    }

    return {
      total: reviewIds.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    }
  }

  /**
   * Approve a draft response.
   */
  async approveResponse(responseId: string, userId: string) {
    const response = await this.getResponseById(responseId)
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, response.reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:approve_response')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to approve responses',
      })
    }

    const [updated] = await this.db
      .update(reviewResponses)
      .set({
        status: 'approved',
        approvedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId))
      .returning()

    return updated
  }

  /**
   * Reject a draft response.
   */
  async rejectResponse(responseId: string, userId: string) {
    const response = await this.getResponseById(responseId)
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, response.reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to manage responses',
      })
    }

    const [updated] = await this.db
      .update(reviewResponses)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId))
      .returning()

    return updated
  }

  /**
   * Edit a response's content.
   */
  async editResponse(
    responseId: string,
    content: string,
    userId: string
  ) {
    const response = await this.getResponseById(responseId)
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, response.reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to edit responses',
      })
    }

    const [updated] = await this.db
      .update(reviewResponses)
      .set({
        content,
        generatedBy: 'human',
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId))
      .returning()

    return updated
  }

  /**
   * Post an approved response back to the platform.
   */
  async postResponse(responseId: string, userId: string) {
    const response = await this.getResponseById(responseId)

    if (response.status !== 'approved') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Response must be approved before posting',
      })
    }

    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, response.reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to post responses',
      })
    }

    // Get connector instance for posting back
    if (review.connectorInstanceId) {
      const instance = await this.connectorService.getInstanceByIdInternal(
        review.connectorInstanceId
      )

      if (instance.connectorTypeId === 'gbp') {
        const creds = instance.credentials as Record<string, string>
        let accessToken = creds.accessToken

        // Refresh if expired
        if (creds.expiresAt && new Date(creds.expiresAt) <= new Date()) {
          const refreshed = await this.gbpAdapter.refreshAccessToken(
            creds.refreshToken
          )
          accessToken = refreshed.accessToken
          await this.connectorService.updateCredentials(instance.id, {
            ...creds,
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          })
        }

        // Post reply via GBP API
        const gbpResourceName = (review.metadata as Record<string, string>)
          ?.gbpResourceName
        if (gbpResourceName) {
          await this.gbpAdapter.replyToReview(
            accessToken,
            gbpResourceName,
            response.content
          )
        }
      }
    }

    const [updated] = await this.db
      .update(reviewResponses)
      .set({
        status: 'posted',
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId))
      .returning()

    return updated
  }

  /**
   * Delete a review reply from the platform (GBP).
   */
  async deleteReply(reviewId: string, userId: string) {
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to manage review replies',
      })
    }

    // Delete reply from the platform
    if (review.connectorInstanceId) {
      const instance = await this.connectorService.getInstanceByIdInternal(
        review.connectorInstanceId
      )

      if (instance.connectorTypeId === 'gbp') {
        const creds = instance.credentials as Record<string, string>
        let accessToken = creds.accessToken

        // Refresh if expired
        if (creds.expiresAt && new Date(creds.expiresAt) <= new Date()) {
          const refreshed = await this.gbpAdapter.refreshAccessToken(
            creds.refreshToken
          )
          accessToken = refreshed.accessToken
          await this.connectorService.updateCredentials(instance.id, {
            ...creds,
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          })
        }

        const gbpResourceName = (review.metadata as Record<string, string>)
          ?.gbpResourceName
        if (gbpResourceName) {
          await this.gbpAdapter.deleteReviewReply(accessToken, gbpResourceName)
        }
      }
    }

    // Update the latest posted response to reflect deletion
    const latestPosted = await this.db.query.reviewResponses.findFirst({
      where: and(
        eq(reviewResponses.reviewId, reviewId),
        eq(reviewResponses.status, 'posted')
      ),
      orderBy: desc(reviewResponses.createdAt),
    })

    if (latestPosted) {
      await this.db
        .update(reviewResponses)
        .set({
          status: 'deleted',
          updatedAt: new Date(),
        })
        .where(eq(reviewResponses.id, latestPosted.id))
    }

    return { success: true }
  }

  /**
   * Quick respond to a review from the Inbox — creates the response, then
   * actually posts it to the source platform (GBP) and marks it 'posted'.
   *
   * For offline reviews (source='offline', no connector), it just stores the
   * response as 'approved' since there's no platform to post to.
   *
   * If the platform call fails, we throw — the frontend should NOT show
   * success when the reply isn't really live.
   */
  async respondDirectly(
    reviewId: string,
    responseText: string,
    userId: string
  ) {
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' })
    }

    const membership = await this.requireMembership(
      review.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'review:respond')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to respond to reviews',
      })
    }

    // Insert the row first so we have an id to update.
    const [created] = await this.db
      .insert(reviewResponses)
      .values({
        reviewId,
        content: responseText,
        generatedBy: 'human',
        status: 'approved',
        approvedBy: userId,
      })
      .returning()

    // If this review came from a connector (e.g. GBP), actually post the reply.
    if (review.connectorInstanceId) {
      try {
        const instance = await this.connectorService.getInstanceByIdInternal(
          review.connectorInstanceId
        )

        if (instance.connectorTypeId === 'gbp') {
          const creds = instance.credentials as Record<string, string>
          if (!creds?.accessToken || !creds?.refreshToken) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'GBP connector is missing OAuth credentials',
            })
          }

          let accessToken = creds.accessToken
          if (creds.expiresAt && new Date(creds.expiresAt) <= new Date()) {
            const refreshed = await this.gbpAdapter.refreshAccessToken(
              creds.refreshToken
            )
            accessToken = refreshed.accessToken
            await this.connectorService.updateCredentials(instance.id, {
              ...creds,
              accessToken: refreshed.accessToken,
              expiresAt: refreshed.expiresAt,
            })
          }

          const gbpResourceName = (review.metadata as Record<string, string>)
            ?.gbpResourceName

          if (!gbpResourceName) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message:
                'Cannot post reply: review has no GBP resource name. Try syncing reviews again.',
            })
          }

          await this.gbpAdapter.replyToReview(
            accessToken,
            gbpResourceName,
            responseText
          )

          // Mark posted only after the platform accepted it.
          const [posted] = await this.db
            .update(reviewResponses)
            .set({
              status: 'posted',
              postedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(reviewResponses.id, created.id))
            .returning()
          return posted
        }
      } catch (err: any) {
        // Platform post failed — keep the row as 'approved' (so it can be
        // retried via review.postResponse) but bubble the error up so the
        // frontend doesn't tell the user "Reply sent" when it wasn't.
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Failed to post reply to platform',
        })
      }
    }

    // Offline review (no connector) — just keep the response as 'approved'.
    return created
  }

  /**
   * Sync reviews from a Zomato connector instance.
   */
  private async performZomatoSync(
    instance: typeof connectorInstances.$inferSelect
  ) {
    const config = instance.config as Record<string, string>
    const profileUrl = config?.profileUrl

    if (!profileUrl) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Connector is missing profileUrl in config. Please reconfigure.',
      })
    }

    const zomatoReviews = await this.zomatoAdapter.fetchReviews(profileUrl)

    let synced = 0

    for (const zReview of zomatoReviews) {
      await this.db
        .insert(reviews)
        .values({
          workspaceId: instance.workspaceId,
          locationId: instance.locationId!,
          connectorInstanceId: instance.id,
          platform: 'zomato',
          platformReviewId: zReview.reviewId,
          reviewerName: zReview.reviewerName,
          reviewerAvatarUrl: null,
          rating: zReview.rating,
          text: zReview.text ?? null,
          reviewedAt: new Date(zReview.reviewedAt),
          metadata: { likes: zReview.likes },
        })
        .onConflictDoUpdate({
          target: [],
          set: {
            reviewerName: zReview.reviewerName,
            rating: zReview.rating,
            text: zReview.text ?? null,
            updatedAt: new Date(),
          },
          setWhere: sql`1=0`,
        })
        .catch(() => {
          // Unique constraint violation — already exists, skip
        })

      synced++
    }

    // Update status + last sync time
    await this.connectorService.updateStatus(instance.id, 'connected')
    await this.db
      .update(connectorInstances)
      .set({ lastSyncAt: new Date() })
      .where(eq(connectorInstances.id, instance.id))

    return { synced }
  }

  private resolveDateRange(input: {
    dateRange?: string
    dateFrom?: Date
    dateTo?: Date
  }) {
    const now = new Date()
    let startDate: Date | undefined
    let endDate: Date | undefined = now

    switch (input.dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        startDate = input.dateFrom
        endDate = input.dateTo ?? now
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return { startDate, endDate }
  }

  private async getResponseById(responseId: string) {
    const response = await this.db.query.reviewResponses.findFirst({
      where: eq(reviewResponses.id, responseId),
    })

    if (!response) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Response not found',
      })
    }

    return response
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt)
      ),
    })

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return membership
  }
}
