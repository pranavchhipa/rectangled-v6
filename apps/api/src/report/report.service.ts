import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, gte, lte, sql, desc, isNotNull, count as drizzleCount } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import PDFDocument from 'pdfkit'
import type { Database } from '@rectangled/db'
import {
  reportSnapshots,
  reviews,
  reviewResponses,
  businessAspects,
  truforms,
  truformResponses,
  journeys,
  journeyScreens,
  journeyResponses,
  members,
} from '@rectangled/db'

@Injectable()
export class ReportService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // ──────────────────────────────────────────────
  // Main dispatcher
  // ──────────────────────────────────────────────
  async generateReport(
    input: {
      workspaceId: string
      membershipId: string
      reportType: string
      dateFrom: string
      dateTo: string
      locationId?: string
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const dateFrom = new Date(input.dateFrom)
    const dateTo = new Date(input.dateTo)

    let data: Record<string, unknown>
    let title: string

    switch (input.reportType) {
      case 'orm_overview':
        data = await this.generateOrmOverview(input.workspaceId, dateFrom, dateTo, input.locationId)
        title = 'ORM Overview Report'
        break
      case 'aspect_analysis':
        data = await this.generateAspectAnalysis(input.workspaceId, dateFrom, dateTo, input.locationId)
        title = 'Business Aspect Analysis (CAR)'
        break
      case 'truforms_feedback':
        data = await this.generateTruformsReport(input.workspaceId, dateFrom, dateTo, input.locationId)
        title = 'TruForms Feedback Report'
        break
      case 'journey_analytics':
        data = await this.generateJourneyAnalytics(input.workspaceId, dateFrom, dateTo, input.locationId)
        title = 'Journey Analytics Report'
        break
      default:
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Unsupported report type: ${input.reportType}` })
    }

    const [snapshot] = await this.db
      .insert(reportSnapshots)
      .values({
        workspaceId: input.workspaceId,
        reportType: input.reportType as any,
        title,
        dateFrom,
        dateTo,
        locationId: input.locationId ?? null,
        data,
        generatedByUserId: userId,
      })
      .returning()

    return snapshot
  }

  // ──────────────────────────────────────────────
  // ORM Overview
  // ──────────────────────────────────────────────
  private async generateOrmOverview(
    workspaceId: string,
    dateFrom: Date,
    dateTo: Date,
    locationId?: string,
  ): Promise<Record<string, unknown>> {
    const conditions = [
      eq(reviews.workspaceId, workspaceId),
      gte(reviews.reviewedAt, dateFrom),
      lte(reviews.reviewedAt, dateTo),
    ]
    if (locationId) conditions.push(eq(reviews.locationId, locationId))
    const where = and(...conditions)

    const [
      statsResult,
      ratingDistribution,
      sourceBreakdown,
      volumeTrend,
      topPositiveAspects,
      topNegativeAspects,
    ] = await Promise.all([
      // Aggregate stats
      this.db
        .select({
          totalReviews: sql<number>`count(*)::int`,
          averageRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
          onlineCount: sql<number>`count(*) filter (where ${reviews.source} = 'online')::int`,
          offlineCount: sql<number>`count(*) filter (where ${reviews.source} = 'offline')::int`,
        })
        .from(reviews)
        .where(where),

      // Rating distribution
      this.db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.rating)
        .orderBy(reviews.rating),

      // Source breakdown
      this.db
        .select({
          source: reviews.source,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.source),

      // Volume trend (daily)
      this.db
        .select({
          date: sql<string>`date_trunc('day', ${reviews.reviewedAt})::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(where)
        .groupBy(sql`date_trunc('day', ${reviews.reviewedAt})`)
        .orderBy(sql`date_trunc('day', ${reviews.reviewedAt})`),

      // Top positive aspects
      this.db
        .select({
          aspect: sql<string>`unnest(${reviews.aspectTags})`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(
          and(
            ...conditions,
            gte(reviews.rating, 4),
            sql`${reviews.aspectTags} IS NOT NULL AND array_length(${reviews.aspectTags}, 1) > 0`,
          ),
        )
        .groupBy(sql`unnest(${reviews.aspectTags})`)
        .orderBy(sql`count(*) DESC`)
        .limit(5),

      // Top negative aspects
      this.db
        .select({
          aspect: sql<string>`unnest(${reviews.aspectTags})`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(
          and(
            ...conditions,
            lte(reviews.rating, 2),
            sql`${reviews.aspectTags} IS NOT NULL AND array_length(${reviews.aspectTags}, 1) > 0`,
          ),
        )
        .groupBy(sql`unnest(${reviews.aspectTags})`)
        .orderBy(sql`count(*) DESC`)
        .limit(5),
    ])

    // Response rate
    const [responseRateResult] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        responded: sql<number>`count(distinct ${reviewResponses.reviewId})::int`,
      })
      .from(reviews)
      .leftJoin(reviewResponses, eq(reviews.id, reviewResponses.reviewId))
      .where(where)

    const total = statsResult[0]?.totalReviews ?? 0
    const responded = responseRateResult?.responded ?? 0
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

    return {
      totalReviews: statsResult[0]?.totalReviews ?? 0,
      averageRating: statsResult[0]?.averageRating ?? 0,
      onlineCount: statsResult[0]?.onlineCount ?? 0,
      offlineCount: statsResult[0]?.offlineCount ?? 0,
      responseRate,
      ratingDistribution,
      sourceBreakdown,
      volumeTrend,
      topPositiveAspects,
      topNegativeAspects,
    }
  }

  // ──────────────────────────────────────────────
  // Aspect Analysis (CAR)
  // ──────────────────────────────────────────────
  private async generateAspectAnalysis(
    workspaceId: string,
    dateFrom: Date,
    dateTo: Date,
    locationId?: string,
  ): Promise<Record<string, unknown>> {
    const conditions = [
      eq(reviews.workspaceId, workspaceId),
      gte(reviews.reviewedAt, dateFrom),
      lte(reviews.reviewedAt, dateTo),
      sql`${reviews.aspectTags} IS NOT NULL AND array_length(${reviews.aspectTags}, 1) > 0`,
    ]
    if (locationId) conditions.push(eq(reviews.locationId, locationId))
    const where = and(...conditions)

    // Per-aspect scores + mention frequency
    const perAspectScores = await this.db
      .select({
        aspect: sql<string>`unnest(${reviews.aspectTags})`,
        avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
        mentionCount: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(where)
      .groupBy(sql`unnest(${reviews.aspectTags})`)
      .orderBy(sql`count(*) DESC`)

    // Critical aspects: avg rating < 3 and mentioned > 5 times
    const criticalAspects = perAspectScores.filter(
      (a) => a.avgRating < 3 && a.mentionCount > 5,
    )

    // Aspect sentiment breakdown
    const aspectSentiment = await this.db
      .select({
        aspect: sql<string>`unnest(${reviews.aspectTags})`,
        sentiment: reviews.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(where)
      .groupBy(sql`unnest(${reviews.aspectTags})`, reviews.sentiment)
      .orderBy(sql`unnest(${reviews.aspectTags})`)

    // Aspect trends (monthly)
    const aspectTrends = await this.db
      .select({
        aspect: sql<string>`unnest(${reviews.aspectTags})`,
        month: sql<string>`date_trunc('month', ${reviews.reviewedAt})::date::text`,
        avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
      })
      .from(reviews)
      .where(where)
      .groupBy(sql`unnest(${reviews.aspectTags})`, sql`date_trunc('month', ${reviews.reviewedAt})`)
      .orderBy(sql`date_trunc('month', ${reviews.reviewedAt})`)

    // All workspace business aspects for reference
    const allAspects = await this.db
      .select()
      .from(businessAspects)
      .where(
        and(
          eq(businessAspects.workspaceId, workspaceId),
          eq(businessAspects.isActive, true),
        ),
      )

    return {
      perAspectScores,
      criticalAspects,
      aspectSentiment,
      aspectTrends,
      configuredAspects: allAspects.map((a) => ({ name: a.name, category: a.category })),
    }
  }

  // ──────────────────────────────────────────────
  // TruForms Feedback
  // ──────────────────────────────────────────────
  private async generateTruformsReport(
    workspaceId: string,
    dateFrom: Date,
    dateTo: Date,
    locationId?: string,
  ): Promise<Record<string, unknown>> {
    // Get all forms for workspace
    const formConditions = [eq(truforms.workspaceId, workspaceId)]
    if (locationId) formConditions.push(eq(truforms.locationId, locationId))

    const allForms = await this.db
      .select()
      .from(truforms)
      .where(and(...formConditions))

    const formIds = allForms.map((f) => f.id)

    if (formIds.length === 0) {
      return {
        npsScore: 0,
        csatScore: 0,
        cesScore: 0,
        totalResponses: 0,
        perFormStats: [],
        npsTrend: [],
      }
    }

    // Get all responses in date range
    const allResponses = await this.db
      .select()
      .from(truformResponses)
      .where(
        and(
          sql`${truformResponses.truformId} IN ${formIds}`,
          gte(truformResponses.createdAt, dateFrom),
          lte(truformResponses.createdAt, dateTo),
        ),
      )

    // Build per-form stats
    const perFormStats = allForms.map((form) => {
      const formResponses = allResponses.filter((r) => r.truformId === form.id)
      const scores = formResponses.filter((r) => r.score !== null).map((r) => r.score!)
      const totalResp = formResponses.length
      const completedResp = formResponses.filter((r) => r.completedAt !== null).length
      const completionRate = totalResp > 0 ? Math.round((completedResp / totalResp) * 100) : 0
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0

      return {
        formId: form.id,
        formName: form.name,
        formType: form.type,
        responseCount: totalResp,
        avgScore,
        completionRate,
      }
    })

    // NPS calculation (across all NPS forms)
    const npsForms = allForms.filter((f) => f.type === 'nps')
    const npsFormIds = npsForms.map((f) => f.id)
    const npsResponses = allResponses.filter((r) => npsFormIds.includes(r.truformId) && r.score !== null)
    const promoters = npsResponses.filter((r) => r.score! >= 9).length
    const detractors = npsResponses.filter((r) => r.score! <= 6).length
    const npsTotal = npsResponses.length
    const npsScore = npsTotal > 0 ? Math.round(((promoters - detractors) / npsTotal) * 100) : 0

    // CSAT calculation
    const csatForms = allForms.filter((f) => f.type === 'csat')
    const csatFormIds = csatForms.map((f) => f.id)
    const csatResponses = allResponses.filter((r) => csatFormIds.includes(r.truformId) && r.score !== null)
    const csatScores = csatResponses.map((r) => r.score!)
    const csatScore = csatScores.length > 0
      ? Math.round((csatScores.reduce((a, b) => a + b, 0) / csatScores.length) * 100) / 100
      : 0

    // CES calculation
    const cesForms = allForms.filter((f) => f.type === 'ces')
    const cesFormIds = cesForms.map((f) => f.id)
    const cesResponses = allResponses.filter((r) => cesFormIds.includes(r.truformId) && r.score !== null)
    const cesScores = cesResponses.map((r) => r.score!)
    const cesScore = cesScores.length > 0
      ? Math.round((cesScores.reduce((a, b) => a + b, 0) / cesScores.length) * 100) / 100
      : 0

    // NPS trend (monthly)
    const npsTrend: Array<{ month: string; npsScore: number }> = []
    if (npsResponses.length > 0) {
      const byMonth = new Map<string, Array<number>>()
      for (const r of npsResponses) {
        const month = r.createdAt.toISOString().slice(0, 7)
        if (!byMonth.has(month)) byMonth.set(month, [])
        byMonth.get(month)!.push(r.score!)
      }
      for (const [month, scores] of Array.from(byMonth.entries()).sort()) {
        const p = scores.filter((s) => s >= 9).length
        const d = scores.filter((s) => s <= 6).length
        const t = scores.length
        npsTrend.push({ month, npsScore: t > 0 ? Math.round(((p - d) / t) * 100) : 0 })
      }
    }

    return {
      npsScore,
      npsBreakdown: { promoters, passives: npsTotal - promoters - detractors, detractors, total: npsTotal },
      csatScore,
      cesScore,
      totalResponses: allResponses.length,
      perFormStats,
      npsTrend,
    }
  }

  // ──────────────────────────────────────────────
  // Journey Analytics
  // ──────────────────────────────────────────────
  private async generateJourneyAnalytics(
    workspaceId: string,
    dateFrom: Date,
    dateTo: Date,
    locationId?: string,
  ): Promise<Record<string, unknown>> {
    // Get all journeys
    const journeyConditions = [eq(journeys.workspaceId, workspaceId)]
    if (locationId) journeyConditions.push(eq(journeys.locationId, locationId))

    const allJourneys = await this.db
      .select()
      .from(journeys)
      .where(and(...journeyConditions))

    const journeyIds = allJourneys.map((j) => j.id)

    if (journeyIds.length === 0) {
      return {
        completionRate: 0,
        dropOffByScreen: [],
        avgCompletionTime: 0,
        positiveRatio: 0,
        reviewsGenerated: 0,
        perJourneyStats: [],
      }
    }

    // Get all responses in date range
    const allJourneyResponses = await this.db
      .select()
      .from(journeyResponses)
      .where(
        and(
          sql`${journeyResponses.journeyId} IN ${journeyIds}`,
          gte(journeyResponses.createdAt, dateFrom),
          lte(journeyResponses.createdAt, dateTo),
        ),
      )

    // Get all screens for these journeys
    const allScreens = await this.db
      .select()
      .from(journeyScreens)
      .where(sql`${journeyScreens.journeyId} IN ${journeyIds}`)
      .orderBy(journeyScreens.journeyId, journeyScreens.order)

    // Group responses by session to detect completion
    const sessionMap = new Map<string, typeof allJourneyResponses>()
    for (const resp of allJourneyResponses) {
      const key = resp.sessionId
      if (!sessionMap.has(key)) sessionMap.set(key, [])
      sessionMap.get(key)!.push(resp)
    }

    const totalSessions = sessionMap.size

    // Compute completion: sessions that have a response on the last screen
    let completedSessions = 0
    const screenCountByJourney = new Map<string, number>()
    for (const s of allScreens) {
      const current = screenCountByJourney.get(s.journeyId) ?? 0
      screenCountByJourney.set(s.journeyId, Math.max(current, s.order))
    }

    // Drop-off by screen order
    const screenOrderCounts = new Map<number, number>()

    for (const [, sessionResponses] of sessionMap) {
      // Determine the journey for this session
      const journeyId = sessionResponses[0].journeyId
      const maxOrder = screenCountByJourney.get(journeyId) ?? 1

      // Find max screen order reached
      let maxReachedOrder = 0
      for (const resp of sessionResponses) {
        const screen = allScreens.find((s) => s.id === resp.journeyScreenId)
        if (screen && screen.order > maxReachedOrder) {
          maxReachedOrder = screen.order
        }
      }

      if (maxReachedOrder >= maxOrder) {
        completedSessions++
      }

      // Count per screen order
      for (let order = 1; order <= maxReachedOrder; order++) {
        screenOrderCounts.set(order, (screenOrderCounts.get(order) ?? 0) + 1)
      }
    }

    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

    // Drop-off by screen
    const dropOffByScreen = Array.from(screenOrderCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([order, count]) => ({ screenOrder: order, sessions: count }))

    // Avg completion time (between first and last response in a session)
    let totalCompletionTimeMs = 0
    let completedCount = 0
    for (const [, sessionResponses] of sessionMap) {
      if (sessionResponses.length < 2) continue
      const sorted = sessionResponses.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )
      const diff = sorted[sorted.length - 1].createdAt.getTime() - sorted[0].createdAt.getTime()
      if (diff > 0) {
        totalCompletionTimeMs += diff
        completedCount++
      }
    }
    const avgCompletionTimeSec = completedCount > 0 ? Math.round(totalCompletionTimeMs / completedCount / 1000) : 0

    // Positive vs negative ratio from response data
    let positiveCount = 0
    let totalRated = 0
    for (const resp of allJourneyResponses) {
      const data = resp.responseData as Record<string, unknown>
      if (data.rating !== undefined) {
        totalRated++
        if ((data.rating as number) >= 4) positiveCount++
      }
    }
    const positiveRatio = totalRated > 0 ? Math.round((positiveCount / totalRated) * 100) : 0

    // Reviews generated from journeys
    const reviewsFromJourneys = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(
        and(
          eq(reviews.workspaceId, workspaceId),
          isNotNull(reviews.journeyResponseId),
          gte(reviews.reviewedAt, dateFrom),
          lte(reviews.reviewedAt, dateTo),
        ),
      )
    const reviewsGenerated = reviewsFromJourneys[0]?.count ?? 0

    // Per-journey stats
    const perJourneyStats = allJourneys.map((journey) => {
      const jResponses = allJourneyResponses.filter((r) => r.journeyId === journey.id)
      const jSessions = new Set(jResponses.map((r) => r.sessionId))
      const jScreens = allScreens.filter((s) => s.journeyId === journey.id)
      const maxOrder = Math.max(...jScreens.map((s) => s.order), 1)

      let jCompleted = 0
      for (const sessionId of jSessions) {
        const sResponses = jResponses.filter((r) => r.sessionId === sessionId)
        let maxReached = 0
        for (const resp of sResponses) {
          const screen = jScreens.find((s) => s.id === resp.journeyScreenId)
          if (screen && screen.order > maxReached) maxReached = screen.order
        }
        if (maxReached >= maxOrder) jCompleted++
      }

      return {
        journeyId: journey.id,
        journeyName: journey.name,
        totalSessions: jSessions.size,
        completedSessions: jCompleted,
        completionRate: jSessions.size > 0 ? Math.round((jCompleted / jSessions.size) * 100) : 0,
        screenCount: jScreens.length,
      }
    })

    return {
      completionRate,
      dropOffByScreen,
      avgCompletionTimeSec,
      positiveRatio,
      reviewsGenerated,
      totalSessions,
      completedSessions,
      perJourneyStats,
    }
  }

  // ──────────────────────────────────────────────
  // Get / List / Delete / Share
  // ──────────────────────────────────────────────
  async getReport(reportId: string, userId: string) {
    const report = await this.db.query.reportSnapshots.findFirst({
      where: eq(reportSnapshots.id, reportId),
    })
    if (!report) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' })
    }
    await this.requireMembership(report.workspaceId, userId)
    return report
  }

  async listReports(
    input: {
      workspaceId: string
      reportType?: string
      page: number
      limit: number
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const page = input.page
    const limit = Math.min(input.limit, 100)
    const offset = (page - 1) * limit

    const conditions = [eq(reportSnapshots.workspaceId, input.workspaceId)]
    if (input.reportType) {
      conditions.push(eq(reportSnapshots.reportType, input.reportType as any))
    }
    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: reportSnapshots.id,
          reportType: reportSnapshots.reportType,
          title: reportSnapshots.title,
          dateFrom: reportSnapshots.dateFrom,
          dateTo: reportSnapshots.dateTo,
          locationId: reportSnapshots.locationId,
          shareToken: reportSnapshots.shareToken,
          createdAt: reportSnapshots.createdAt,
        })
        .from(reportSnapshots)
        .where(where)
        .orderBy(desc(reportSnapshots.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(reportSnapshots)
        .where(where),
    ])

    return {
      data,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit),
    }
  }

  async deleteReport(reportId: string, userId: string) {
    const report = await this.db.query.reportSnapshots.findFirst({
      where: eq(reportSnapshots.id, reportId),
    })
    if (!report) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' })
    }
    await this.requireMembership(report.workspaceId, userId)
    await this.db.delete(reportSnapshots).where(eq(reportSnapshots.id, reportId))
    return { success: true }
  }

  async shareReport(reportId: string, userId: string) {
    const report = await this.db.query.reportSnapshots.findFirst({
      where: eq(reportSnapshots.id, reportId),
    })
    if (!report) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' })
    }
    await this.requireMembership(report.workspaceId, userId)

    if (report.shareToken) {
      return { shareToken: report.shareToken }
    }

    const shareToken = randomBytes(16).toString('hex')
    await this.db
      .update(reportSnapshots)
      .set({ shareToken })
      .where(eq(reportSnapshots.id, reportId))

    return { shareToken }
  }

  async getSharedReport(shareToken: string) {
    const report = await this.db.query.reportSnapshots.findFirst({
      where: eq(reportSnapshots.shareToken, shareToken),
    })
    if (!report) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shared report not found' })
    }
    return report
  }

  // ──────────────────────────────────────────────
  // PDF Export
  // ──────────────────────────────────────────────
  async exportPdf(reportId: string, userId: string): Promise<string> {
    const report = await this.getReport(reportId, userId)
    const data = report.data as Record<string, unknown>

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // ── Header ──
    doc.fontSize(24).font('Helvetica-Bold').text('Rectangled.io', { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(16).font('Helvetica').text(report.title, { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor('#666666').text(
      `${report.dateFrom.toISOString().slice(0, 10)} to ${report.dateTo.toISOString().slice(0, 10)}`,
      { align: 'center' },
    )
    doc.fillColor('#000000')
    doc.moveDown(1.5)

    // ── Separator ──
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc')
    doc.moveDown(1)

    // ── Content based on report type ──
    switch (report.reportType) {
      case 'orm_overview':
        this.renderOrmOverviewPdf(doc, data)
        break
      case 'aspect_analysis':
        this.renderAspectAnalysisPdf(doc, data)
        break
      case 'truforms_feedback':
        this.renderTruformsPdf(doc, data)
        break
      case 'journey_analytics':
        this.renderJourneyPdf(doc, data)
        break
    }

    // ── Footer ──
    doc.moveDown(2)
    doc.fontSize(8).fillColor('#999999').text(
      `Generated on ${new Date().toISOString().slice(0, 10)} by Rectangled.io`,
      { align: 'center' },
    )

    doc.end()

    return new Promise<string>((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer.toString('base64'))
      })
      doc.on('error', reject)
    })
  }

  // ── PDF Section Renderers ──

  private renderOrmOverviewPdf(doc: PDFKit.PDFDocument, data: Record<string, unknown>) {
    // Summary metrics
    doc.fontSize(14).font('Helvetica-Bold').text('Summary')
    doc.moveDown(0.5)

    const metrics = [
      ['Total Reviews', String(data.totalReviews ?? 0)],
      ['Average Rating', String(data.averageRating ?? 0)],
      ['Online Reviews', String(data.onlineCount ?? 0)],
      ['Offline Reviews', String(data.offlineCount ?? 0)],
      ['Response Rate', `${data.responseRate ?? 0}%`],
    ]
    this.renderTable(doc, ['Metric', 'Value'], metrics)

    // Rating distribution
    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Rating Distribution')
    doc.moveDown(0.5)
    const ratingDist = (data.ratingDistribution as Array<{ rating: number; count: number }>) ?? []
    this.renderTable(
      doc,
      ['Stars', 'Count'],
      ratingDist.map((r) => [String(r.rating), String(r.count)]),
    )

    // Source breakdown
    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Source Breakdown')
    doc.moveDown(0.5)
    const sources = (data.sourceBreakdown as Array<{ source: string; count: number }>) ?? []
    this.renderTable(
      doc,
      ['Source', 'Count'],
      sources.map((s) => [s.source, String(s.count)]),
    )

    // Top positive aspects
    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Top Positive Aspects')
    doc.moveDown(0.5)
    const posAspects = (data.topPositiveAspects as Array<{ aspect: string; count: number }>) ?? []
    if (posAspects.length > 0) {
      this.renderTable(
        doc,
        ['Aspect', 'Mentions'],
        posAspects.map((a) => [a.aspect, String(a.count)]),
      )
    } else {
      doc.fontSize(10).font('Helvetica').text('No data available.')
    }

    // Top negative aspects
    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Top Negative Aspects')
    doc.moveDown(0.5)
    const negAspects = (data.topNegativeAspects as Array<{ aspect: string; count: number }>) ?? []
    if (negAspects.length > 0) {
      this.renderTable(
        doc,
        ['Aspect', 'Mentions'],
        negAspects.map((a) => [a.aspect, String(a.count)]),
      )
    } else {
      doc.fontSize(10).font('Helvetica').text('No data available.')
    }
  }

  private renderAspectAnalysisPdf(doc: PDFKit.PDFDocument, data: Record<string, unknown>) {
    doc.fontSize(14).font('Helvetica-Bold').text('Per-Aspect Scores')
    doc.moveDown(0.5)
    const aspects = (data.perAspectScores as Array<{ aspect: string; avgRating: number; mentionCount: number }>) ?? []
    this.renderTable(
      doc,
      ['Aspect', 'Avg Rating', 'Mentions'],
      aspects.map((a) => [a.aspect, String(a.avgRating), String(a.mentionCount)]),
    )

    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Critical Aspects (Avg < 3, Mentions > 5)')
    doc.moveDown(0.5)
    const critical = (data.criticalAspects as Array<{ aspect: string; avgRating: number; mentionCount: number }>) ?? []
    if (critical.length > 0) {
      this.renderTable(
        doc,
        ['Aspect', 'Avg Rating', 'Mentions'],
        critical.map((a) => [a.aspect, String(a.avgRating), String(a.mentionCount)]),
      )
    } else {
      doc.fontSize(10).font('Helvetica').text('No critical aspects found.')
    }
  }

  private renderTruformsPdf(doc: PDFKit.PDFDocument, data: Record<string, unknown>) {
    doc.fontSize(14).font('Helvetica-Bold').text('Score Summary')
    doc.moveDown(0.5)

    const breakdown = data.npsBreakdown as Record<string, number> | undefined
    const metrics = [
      ['NPS Score', String(data.npsScore ?? 0)],
      ['CSAT Score', String(data.csatScore ?? 0)],
      ['CES Score', String(data.cesScore ?? 0)],
      ['Total Responses', String(data.totalResponses ?? 0)],
    ]
    if (breakdown) {
      metrics.push(
        ['NPS Promoters', String(breakdown.promoters ?? 0)],
        ['NPS Passives', String(breakdown.passives ?? 0)],
        ['NPS Detractors', String(breakdown.detractors ?? 0)],
      )
    }
    this.renderTable(doc, ['Metric', 'Value'], metrics)

    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Per-Form Statistics')
    doc.moveDown(0.5)
    const perForm = (data.perFormStats as Array<{
      formName: string
      formType: string
      responseCount: number
      avgScore: number
      completionRate: number
    }>) ?? []
    if (perForm.length > 0) {
      this.renderTable(
        doc,
        ['Form', 'Type', 'Responses', 'Avg Score', 'Completion %'],
        perForm.map((f) => [f.formName, f.formType, String(f.responseCount), String(f.avgScore), `${f.completionRate}%`]),
      )
    } else {
      doc.fontSize(10).font('Helvetica').text('No forms found.')
    }
  }

  private renderJourneyPdf(doc: PDFKit.PDFDocument, data: Record<string, unknown>) {
    doc.fontSize(14).font('Helvetica-Bold').text('Journey Summary')
    doc.moveDown(0.5)

    const metrics = [
      ['Total Sessions', String(data.totalSessions ?? 0)],
      ['Completed Sessions', String(data.completedSessions ?? 0)],
      ['Completion Rate', `${data.completionRate ?? 0}%`],
      ['Avg Completion Time', `${data.avgCompletionTimeSec ?? 0}s`],
      ['Positive Ratio', `${data.positiveRatio ?? 0}%`],
      ['Reviews Generated', String(data.reviewsGenerated ?? 0)],
    ]
    this.renderTable(doc, ['Metric', 'Value'], metrics)

    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Drop-off by Screen')
    doc.moveDown(0.5)
    const dropOff = (data.dropOffByScreen as Array<{ screenOrder: number; sessions: number }>) ?? []
    if (dropOff.length > 0) {
      this.renderTable(
        doc,
        ['Screen #', 'Sessions'],
        dropOff.map((d) => [String(d.screenOrder), String(d.sessions)]),
      )
    } else {
      doc.fontSize(10).font('Helvetica').text('No data available.')
    }

    doc.moveDown(1)
    doc.fontSize(14).font('Helvetica-Bold').text('Per-Journey Statistics')
    doc.moveDown(0.5)
    const perJourney = (data.perJourneyStats as Array<{
      journeyName: string
      totalSessions: number
      completedSessions: number
      completionRate: number
      screenCount: number
    }>) ?? []
    if (perJourney.length > 0) {
      this.renderTable(
        doc,
        ['Journey', 'Sessions', 'Completed', 'Rate', 'Screens'],
        perJourney.map((j) => [
          j.journeyName,
          String(j.totalSessions),
          String(j.completedSessions),
          `${j.completionRate}%`,
          String(j.screenCount),
        ]),
      )
    } else {
      doc.fontSize(10).font('Helvetica').text('No journeys found.')
    }
  }

  // ── Table Helper ──
  private renderTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
    const startX = 50
    const colWidth = Math.floor(495 / headers.length)
    const rowHeight = 20

    // Header row
    doc.fontSize(9).font('Helvetica-Bold')
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], startX + i * colWidth, doc.y, {
        width: colWidth,
        continued: i < headers.length - 1,
      })
    }
    doc.text('', startX) // newline
    doc.moveDown(0.2)

    // Draw header line
    const lineY = doc.y
    doc.moveTo(startX, lineY).lineTo(startX + 495, lineY).stroke('#cccccc')
    doc.moveDown(0.3)

    // Data rows
    doc.fontSize(9).font('Helvetica')
    for (const row of rows) {
      // Check if we need a new page
      if (doc.y > 740) {
        doc.addPage()
        doc.y = 50
      }
      const rowY = doc.y
      for (let i = 0; i < row.length; i++) {
        doc.text(row[i] ?? '', startX + i * colWidth, rowY, {
          width: colWidth,
        })
      }
      doc.y = rowY + rowHeight
    }
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt),
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
