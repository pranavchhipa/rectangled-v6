import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, gte, lte, sql, desc, isNotNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import {
  emotionDefinitions,
  nevResponses,
  members,
} from '@rectangled/db'
import { DEFAULT_EMOTIONS } from '@rectangled/shared'

@Injectable()
export class NevService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * Seed the 20 default emotion definitions if they don't exist yet.
   */
  async seedEmotions() {
    const existing = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emotionDefinitions)

    if ((existing[0]?.count ?? 0) > 0) {
      return { seeded: false, message: 'Emotions already seeded' }
    }

    const values = DEFAULT_EMOTIONS.map((e) => ({
      id: randomUUID(),
      name: e.name,
      cluster: e.cluster as 'joy' | 'comfort' | 'frustration' | 'anxiety',
      polarity: e.polarity as 'positive' | 'negative',
      emoji: e.emoji,
      description: e.description,
      sortOrder: e.sortOrder,
    }))

    await this.db.insert(emotionDefinitions).values(values)
    return { seeded: true, count: values.length }
  }

  /**
   * Return all 20 emotion definitions for UI rendering.
   */
  async getEmotionDefinitions() {
    return this.db.query.emotionDefinitions.findMany({
      orderBy: [emotionDefinitions.sortOrder],
    })
  }

  /**
   * Submit a NEV response. Calculate per-response NEV score and store.
   */
  async submitResponse(input: {
    workspaceId?: string
    customerId?: string
    locationId?: string
    emotions: Array<{ emotionId: string; intensity: number }>
    source: 'active_survey' | 'passive_nlp' | 'journey'
    reviewId?: string
    truformResponseId?: string
    journeyResponseId?: string
    rawText?: string
  }) {
    // Fetch emotion definitions to determine polarity
    const allEmotions = await this.db.query.emotionDefinitions.findMany()
    const emotionMap = new Map(allEmotions.map((e) => [e.id, e]))

    let positiveSum = 0
    let negativeSum = 0

    for (const emotion of input.emotions) {
      const def = emotionMap.get(emotion.emotionId)
      if (!def) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown emotion ID: ${emotion.emotionId}`,
        })
      }
      if (def.polarity === 'positive') {
        positiveSum += emotion.intensity
      } else {
        negativeSum += emotion.intensity
      }
    }

    const total = positiveSum + negativeSum
    const nevScore = total > 0
      ? ((positiveSum - negativeSum) / total) * 100
      : 0

    // Phase 5 — truform_response_id / journey_response_id columns
    // dropped (migration 0015). Inputs are still accepted for
    // back-compat but flow into a metadata field on responseData via
    // the rawText escape hatch (nev_responses doesn't have a metadata
    // column; the legacy id is best-effort recorded in rawText if no
    // free text was provided).
    const [response] = await this.db
      .insert(nevResponses)
      .values({
        workspaceId: input.workspaceId!,
        customerId: input.customerId,
        locationId: input.locationId,
        reviewId: input.reviewId,
        source: input.source,
        emotions: input.emotions,
        nevScore,
        rawText: input.rawText,
      })
      .returning()

    return { ...response, nevScore }
  }

  /**
   * Get aggregate NEV analytics for a workspace.
   */
  async getAnalytics(
    input: {
      workspaceId: string
      locationId?: string
      dateFrom?: Date
      dateTo?: Date
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const conditions: ReturnType<typeof eq>[] = [
      eq(nevResponses.workspaceId, input.workspaceId),
    ]
    if (input.locationId) {
      conditions.push(eq(nevResponses.locationId, input.locationId))
    }
    if (input.dateFrom) {
      conditions.push(gte(nevResponses.createdAt, input.dateFrom))
    }
    if (input.dateTo) {
      conditions.push(lte(nevResponses.createdAt, input.dateTo))
    }
    const where = and(...conditions)

    // Overall NEV score
    const [overallResult] = await this.db
      .select({
        totalResponses: sql<number>`count(*)::int`,
        avgNev: sql<number>`round(avg(${nevResponses.nevScore})::numeric, 2)::float`,
      })
      .from(nevResponses)
      .where(where)

    // Fetch all responses for emotion-level breakdown
    const allResponses = await this.db
      .select({ emotions: nevResponses.emotions })
      .from(nevResponses)
      .where(where)

    // Aggregate emotion intensities
    const emotionTotals = new Map<string, { total: number; count: number }>()
    for (const row of allResponses) {
      const emotions = row.emotions as Array<{ emotionId: string; intensity: number }>
      for (const e of emotions) {
        const curr = emotionTotals.get(e.emotionId) ?? { total: 0, count: 0 }
        curr.total += e.intensity
        curr.count += 1
        emotionTotals.set(e.emotionId, curr)
      }
    }

    // Fetch definitions for enrichment
    const allEmotions = await this.db.query.emotionDefinitions.findMany({
      orderBy: [emotionDefinitions.sortOrder],
    })
    const emotionMap = new Map(allEmotions.map((e) => [e.id, e]))

    // Build per-cluster breakdown
    const clusterScores: Record<string, { positiveSum: number; negativeSum: number; count: number }> = {
      joy: { positiveSum: 0, negativeSum: 0, count: 0 },
      comfort: { positiveSum: 0, negativeSum: 0, count: 0 },
      frustration: { positiveSum: 0, negativeSum: 0, count: 0 },
      anxiety: { positiveSum: 0, negativeSum: 0, count: 0 },
    }

    const emotionBreakdown: Array<{
      emotionId: string
      name: string
      cluster: string
      polarity: string
      emoji: string
      avgIntensity: number
      count: number
    }> = []

    for (const [emotionId, data] of emotionTotals) {
      const def = emotionMap.get(emotionId)
      if (!def) continue
      const avgIntensity = Math.round((data.total / data.count) * 100) / 100

      emotionBreakdown.push({
        emotionId,
        name: def.name,
        cluster: def.cluster,
        polarity: def.polarity,
        emoji: def.emoji,
        avgIntensity,
        count: data.count,
      })

      const cluster = clusterScores[def.cluster]
      if (cluster) {
        if (def.polarity === 'positive') {
          cluster.positiveSum += data.total
        } else {
          cluster.negativeSum += data.total
        }
        cluster.count += data.count
      }
    }

    // Sort by count descending to show top emotions
    emotionBreakdown.sort((a, b) => b.count - a.count)

    const clusterBreakdown = Object.entries(clusterScores).map(
      ([cluster, data]) => {
        const total = data.positiveSum + data.negativeSum
        const score = total > 0
          ? Math.round(((data.positiveSum - data.negativeSum) / total) * 100)
          : 0
        return { cluster, score, count: data.count }
      }
    )

    return {
      totalResponses: overallResult?.totalResponses ?? 0,
      overallNev: overallResult?.avgNev ?? 0,
      clusterBreakdown,
      topEmotions: emotionBreakdown.slice(0, 10),
      emotionDistribution: emotionBreakdown,
    }
  }

  /**
   * Time-series NEV data grouped by period.
   */
  async getTrends(
    input: {
      workspaceId: string
      locationId?: string
      period: 'daily' | 'weekly' | 'monthly'
      dateFrom?: Date
      dateTo?: Date
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const truncUnit =
      input.period === 'daily' ? 'day' : input.period === 'weekly' ? 'week' : 'month'

    const conditions: ReturnType<typeof eq>[] = [
      eq(nevResponses.workspaceId, input.workspaceId),
    ]
    if (input.locationId) {
      conditions.push(eq(nevResponses.locationId, input.locationId))
    }
    if (input.dateFrom) {
      conditions.push(gte(nevResponses.createdAt, input.dateFrom))
    }
    if (input.dateTo) {
      conditions.push(lte(nevResponses.createdAt, input.dateTo))
    }
    const where = and(...conditions)

    const trends = await this.db
      .select({
        period: sql<string>`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${nevResponses.createdAt})::date::text`,
        avgNev: sql<number>`round(avg(${nevResponses.nevScore})::numeric, 2)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(nevResponses)
      .where(where)
      .groupBy(sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${nevResponses.createdAt})`)
      .orderBy(sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${nevResponses.createdAt})`)

    return trends
  }

  /**
   * Stub for passive NLP analysis — returns mock emotions for now.
   * TODO: Integrate AI model for real text emotion detection.
   */
  async analyzeText(
    input: { workspaceId: string; text: string; reviewId?: string },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Fetch definitions to pick some mock emotions
    const allEmotions = await this.db.query.emotionDefinitions.findMany({
      orderBy: [emotionDefinitions.sortOrder],
    })

    // Mock: return 3 random emotions with moderate intensity
    const mockEmotions = allEmotions
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((e) => ({
        emotionId: e.id,
        name: e.name,
        cluster: e.cluster,
        polarity: e.polarity,
        emoji: e.emoji,
        intensity: Math.floor(Math.random() * 3) + 2, // 2-4
      }))

    return {
      text: input.text,
      detectedEmotions: mockEmotions,
      note: 'This is a mock analysis. AI integration pending.',
    }
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
