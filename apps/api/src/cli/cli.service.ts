import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, gte, lte, sql, desc, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { cliResponses, members } from '@rectangled/db'
import { calculateCliScore, determineCliSegment, CLI_SEGMENTS } from '@rectangled/shared'

@Injectable()
export class CliService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * Submit a CLI response. Calculate composite score, determine segment, store.
   */
  async submitResponse(input: {
    workspaceId?: string
    customerId?: string
    locationId?: string
    trustScore: number
    satisfactionScore: number
    advocacyScore: number
    truformResponseId?: string
    journeyResponseId?: string
    metadata?: Record<string, unknown>
  }) {
    const cliScore = calculateCliScore(
      input.trustScore,
      input.satisfactionScore,
      input.advocacyScore
    )
    const segment = determineCliSegment(cliScore)

    const [response] = await this.db
      .insert(cliResponses)
      .values({
        workspaceId: input.workspaceId!,
        customerId: input.customerId,
        locationId: input.locationId,
        truformResponseId: input.truformResponseId,
        journeyResponseId: input.journeyResponseId,
        trustScore: input.trustScore,
        satisfactionScore: input.satisfactionScore,
        advocacyScore: input.advocacyScore,
        cliScore,
        segment,
        metadata: input.metadata ?? {},
      })
      .returning()

    return { ...response, cliScore, segment }
  }

  /**
   * Aggregate CLI analytics for a workspace.
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
      eq(cliResponses.workspaceId, input.workspaceId),
    ]
    if (input.locationId) {
      conditions.push(eq(cliResponses.locationId, input.locationId))
    }
    if (input.dateFrom) {
      conditions.push(gte(cliResponses.createdAt, input.dateFrom))
    }
    if (input.dateTo) {
      conditions.push(lte(cliResponses.createdAt, input.dateTo))
    }
    const where = and(...conditions)

    const [overallResult] = await this.db
      .select({
        totalResponses: sql<number>`count(*)::int`,
        avgCli: sql<number>`round(avg(${cliResponses.cliScore})::numeric, 2)::float`,
        avgTrust: sql<number>`round(avg(${cliResponses.trustScore})::numeric, 2)::float`,
        avgSatisfaction: sql<number>`round(avg(${cliResponses.satisfactionScore})::numeric, 2)::float`,
        avgAdvocacy: sql<number>`round(avg(${cliResponses.advocacyScore})::numeric, 2)::float`,
      })
      .from(cliResponses)
      .where(where)

    // Segment distribution
    const segmentDistribution = await this.db
      .select({
        segment: cliResponses.segment,
        count: sql<number>`count(*)::int`,
      })
      .from(cliResponses)
      .where(where)
      .groupBy(cliResponses.segment)

    const total = overallResult?.totalResponses ?? 0
    const segments = CLI_SEGMENTS.map((seg) => {
      const found = segmentDistribution.find((s) => s.segment === seg.key)
      const count = found?.count ?? 0
      return {
        key: seg.key,
        label: seg.label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }
    })

    return {
      totalResponses: total,
      overallCli: overallResult?.avgCli ?? 0,
      pillarAverages: {
        trust: overallResult?.avgTrust ?? 0,
        satisfaction: overallResult?.avgSatisfaction ?? 0,
        advocacy: overallResult?.avgAdvocacy ?? 0,
      },
      segmentDistribution: segments,
    }
  }

  /**
   * Time-series CLI data grouped by period.
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
      eq(cliResponses.workspaceId, input.workspaceId),
    ]
    if (input.locationId) {
      conditions.push(eq(cliResponses.locationId, input.locationId))
    }
    if (input.dateFrom) {
      conditions.push(gte(cliResponses.createdAt, input.dateFrom))
    }
    if (input.dateTo) {
      conditions.push(lte(cliResponses.createdAt, input.dateTo))
    }
    const where = and(...conditions)

    return this.db
      .select({
        period: sql<string>`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${cliResponses.createdAt})::date::text`,
        avgCli: sql<number>`round(avg(${cliResponses.cliScore})::numeric, 2)::float`,
        avgTrust: sql<number>`round(avg(${cliResponses.trustScore})::numeric, 2)::float`,
        avgSatisfaction: sql<number>`round(avg(${cliResponses.satisfactionScore})::numeric, 2)::float`,
        avgAdvocacy: sql<number>`round(avg(${cliResponses.advocacyScore})::numeric, 2)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(cliResponses)
      .where(where)
      .groupBy(sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${cliResponses.createdAt})`)
      .orderBy(sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${cliResponses.createdAt})`)
  }

  /**
   * Customer segment breakdown with counts and percentages.
   */
  async getSegments(
    input: {
      workspaceId: string
      locationId?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const conditions: ReturnType<typeof eq>[] = [
      eq(cliResponses.workspaceId, input.workspaceId),
    ]
    if (input.locationId) {
      conditions.push(eq(cliResponses.locationId, input.locationId))
    }
    const where = and(...conditions)

    const segmentData = await this.db
      .select({
        segment: cliResponses.segment,
        count: sql<number>`count(*)::int`,
        avgCli: sql<number>`round(avg(${cliResponses.cliScore})::numeric, 2)::float`,
      })
      .from(cliResponses)
      .where(where)
      .groupBy(cliResponses.segment)

    const total = segmentData.reduce((sum, s) => sum + s.count, 0)

    return CLI_SEGMENTS.map((seg) => {
      const found = segmentData.find((s) => s.segment === seg.key)
      const count = found?.count ?? 0
      return {
        key: seg.key,
        label: seg.label,
        description: seg.description,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        avgCli: found?.avgCli ?? 0,
      }
    })
  }

  /**
   * Get an individual customer's CLI history.
   */
  async getCustomerCli(
    input: { workspaceId: string; customerId: string },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const responses = await this.db
      .select()
      .from(cliResponses)
      .where(
        and(
          eq(cliResponses.workspaceId, input.workspaceId),
          eq(cliResponses.customerId, input.customerId)
        )
      )
      .orderBy(desc(cliResponses.createdAt))

    if (responses.length === 0) {
      return { customerId: input.customerId, responses: [], currentSegment: null, avgCli: null }
    }

    const avgCli =
      Math.round(
        (responses.reduce((sum, r) => sum + r.cliScore, 0) / responses.length) * 100
      ) / 100

    return {
      customerId: input.customerId,
      responses,
      currentSegment: responses[0].segment,
      avgCli,
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
