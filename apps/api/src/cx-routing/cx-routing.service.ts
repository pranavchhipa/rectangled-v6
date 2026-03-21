import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, sql, lte, gte, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  escalationRules,
  escalations,
  reviews,
  members,
  customers,
  locations,
} from '@rectangled/db'

@Injectable()
export class CxRoutingService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // ─── Escalation Rules ──────────────────────────────────

  async listRules(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    return this.db
      .select()
      .from(escalationRules)
      .where(eq(escalationRules.workspaceId, workspaceId))
      .orderBy(escalationRules.sortOrder)
  }

  async createRule(
    input: {
      workspaceId: string
      name: string
      triggerType: 'rating_threshold' | 'aspect_match' | 'keyword_match' | 'sentiment' | 'manual'
      triggerConfig: Record<string, unknown>
      assignToUserId?: string
      assignToRole?: string
      priority?: 'low' | 'medium' | 'high' | 'critical'
      slaMinutes?: number
      isActive?: boolean
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const [rule] = await this.db
      .insert(escalationRules)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig,
        assignToUserId: input.assignToUserId ?? null,
        assignToRole: input.assignToRole ?? null,
        priority: input.priority ?? 'medium',
        slaMinutes: input.slaMinutes ?? null,
        isActive: input.isActive ?? true,
      })
      .returning()

    return rule
  }

  async updateRule(
    input: {
      workspaceId: string
      ruleId: string
      name?: string
      triggerType?: 'rating_threshold' | 'aspect_match' | 'keyword_match' | 'sentiment' | 'manual'
      triggerConfig?: Record<string, unknown>
      assignToUserId?: string | null
      assignToRole?: string | null
      priority?: 'low' | 'medium' | 'high' | 'critical'
      slaMinutes?: number | null
      isActive?: boolean
      sortOrder?: number
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.escalationRules.findFirst({
      where: and(
        eq(escalationRules.id, input.ruleId),
        eq(escalationRules.workspaceId, input.workspaceId),
      ),
    })

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation rule not found' })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) updates.name = input.name
    if (input.triggerType !== undefined) updates.triggerType = input.triggerType
    if (input.triggerConfig !== undefined) updates.triggerConfig = input.triggerConfig
    if (input.assignToUserId !== undefined) updates.assignToUserId = input.assignToUserId
    if (input.assignToRole !== undefined) updates.assignToRole = input.assignToRole
    if (input.priority !== undefined) updates.priority = input.priority
    if (input.slaMinutes !== undefined) updates.slaMinutes = input.slaMinutes
    if (input.isActive !== undefined) updates.isActive = input.isActive
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder

    const [updated] = await this.db
      .update(escalationRules)
      .set(updates)
      .where(eq(escalationRules.id, input.ruleId))
      .returning()

    return updated
  }

  async deleteRule(workspaceId: string, ruleId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const existing = await this.db.query.escalationRules.findFirst({
      where: and(
        eq(escalationRules.id, ruleId),
        eq(escalationRules.workspaceId, workspaceId),
      ),
    })

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation rule not found' })
    }

    await this.db.delete(escalationRules).where(eq(escalationRules.id, ruleId))
    return { success: true }
  }

  // ─── Review Evaluation ─────────────────────────────────

  async evaluateReview(review: typeof reviews.$inferSelect) {
    const activeRules = await this.db
      .select()
      .from(escalationRules)
      .where(
        and(
          eq(escalationRules.workspaceId, review.workspaceId),
          eq(escalationRules.isActive, true),
        ),
      )
      .orderBy(escalationRules.sortOrder)

    for (const rule of activeRules) {
      const config = rule.triggerConfig as Record<string, unknown>
      let matched = false

      switch (rule.triggerType) {
        case 'rating_threshold': {
          const threshold = Number(config.threshold ?? 2)
          if (review.rating <= threshold) matched = true
          break
        }
        case 'aspect_match': {
          const aspects = (config.aspects as string[]) ?? []
          const reviewAspects = review.aspectTags ?? []
          if (aspects.some((a) => reviewAspects.includes(a))) matched = true
          break
        }
        case 'keyword_match': {
          const keywords = (config.keywords as string[]) ?? []
          const text = (review.text ?? '').toLowerCase()
          if (keywords.some((kw) => text.includes(kw.toLowerCase()))) matched = true
          break
        }
        case 'sentiment': {
          const targetSentiment = config.sentiment as string
          if (review.sentiment === targetSentiment) matched = true
          break
        }
        default:
          break
      }

      if (matched) {
        // Determine assignee — specific user or round-robin by role
        let assignToUserId = rule.assignToUserId

        if (!assignToUserId && rule.assignToRole) {
          assignToUserId = await this.pickRoundRobinUser(
            review.workspaceId,
            rule.assignToRole,
          )
        }

        const slaDeadline = rule.slaMinutes
          ? new Date(Date.now() + rule.slaMinutes * 60 * 1000)
          : null

        const ticketNumber = await this.generateTicketNumber(review.workspaceId)

        const [esc] = await this.db
          .insert(escalations)
          .values({
            workspaceId: review.workspaceId,
            ruleId: rule.id,
            reviewId: review.id,
            customerId: review.customerId ?? null,
            locationId: review.locationId,
            assignedToUserId: assignToUserId ?? null,
            status: 'open',
            priority: rule.priority,
            slaDeadline,
            ticketNumber,
            activityLog: [{ text: 'Ticket created via escalation rule', authorId: 'system', authorName: 'System', timestamp: new Date().toISOString() }],
          })
          .returning()

        return esc
      }
    }

    return null
  }

  // ─── Escalations CRUD ──────────────────────────────────

  async listEscalations(
    input: {
      workspaceId: string
      status?: 'open' | 'in_progress' | 'resolved' | 'expired'
      priority?: 'low' | 'medium' | 'high' | 'critical'
      assignedToUserId?: string
      page?: number
      limit?: number
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const page = input.page ?? 1
    const limit = Math.min(input.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const conditions = [eq(escalations.workspaceId, input.workspaceId)]
    if (input.status) conditions.push(eq(escalations.status, input.status))
    if (input.priority) conditions.push(eq(escalations.priority, input.priority))
    if (input.assignedToUserId) conditions.push(eq(escalations.assignedToUserId, input.assignedToUserId))

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(escalations)
        .where(where)
        .orderBy(desc(escalations.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(escalations)
        .where(where),
    ])

    const total = countResult[0]?.count ?? 0

    // Enrich with review and location data
    const enriched = await Promise.all(
      data.map(async (esc) => {
        let reviewerName: string | null = null
        let reviewRating: number | null = null
        let reviewText: string | null = null
        let reviewedAt: Date | null = null
        let locationName: string | null = null

        if (esc.reviewId) {
          const rev = await this.db.query.reviews.findFirst({
            where: eq(reviews.id, esc.reviewId),
          })
          if (rev) {
            reviewerName = rev.reviewerName
            reviewRating = rev.rating
            reviewText = rev.text ? rev.text.slice(0, 150) : null
            reviewedAt = rev.reviewedAt
          }
        }
        if (esc.locationId) {
          const loc = await this.db.query.locations.findFirst({
            where: eq(locations.id, esc.locationId),
          })
          if (loc) locationName = loc.name
        }

        return {
          ...esc,
          reviewerName,
          reviewRating,
          reviewText,
          reviewedAt,
          locationName,
        }
      })
    )

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getEscalation(workspaceId: string, escalationId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const esc = await this.db.query.escalations.findFirst({
      where: and(
        eq(escalations.id, escalationId),
        eq(escalations.workspaceId, workspaceId),
      ),
    })

    if (!esc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation not found' })
    }

    // Fetch related review and customer
    const [review, customer, location] = await Promise.all([
      esc.reviewId
        ? this.db.query.reviews.findFirst({ where: eq(reviews.id, esc.reviewId) })
        : null,
      esc.customerId
        ? this.db.query.customers.findFirst({ where: eq(customers.id, esc.customerId) })
        : null,
      esc.locationId
        ? this.db.query.locations.findFirst({ where: eq(locations.id, esc.locationId) })
        : null,
    ])

    return { ...esc, review: review ?? null, customer: customer ?? null, location: location ?? null }
  }

  async updateEscalation(
    input: {
      workspaceId: string
      escalationId: string
      status?: 'open' | 'in_progress' | 'resolved' | 'expired'
      assignedToUserId?: string | null
      notes?: string
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.escalations.findFirst({
      where: and(
        eq(escalations.id, input.escalationId),
        eq(escalations.workspaceId, input.workspaceId),
      ),
    })

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation not found' })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.status !== undefined) updates.status = input.status
    if (input.assignedToUserId !== undefined) updates.assignedToUserId = input.assignedToUserId
    if (input.notes !== undefined) updates.notes = input.notes

    const [updated] = await this.db
      .update(escalations)
      .set(updates)
      .where(eq(escalations.id, input.escalationId))
      .returning()

    return updated
  }

  async resolveEscalation(
    input: { workspaceId: string; escalationId: string; notes?: string },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.escalations.findFirst({
      where: and(
        eq(escalations.id, input.escalationId),
        eq(escalations.workspaceId, input.workspaceId),
      ),
    })

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation not found' })
    }

    const [updated] = await this.db
      .update(escalations)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedByUserId: userId,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, input.escalationId))
      .returning()

    return updated
  }

  // ─── Stats ─────────────────────────────────────────────

  async getStats(
    input: { workspaceId: string; dateFrom?: Date; dateTo?: Date },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const conditions = [eq(escalations.workspaceId, input.workspaceId)]
    if (input.dateFrom) conditions.push(gte(escalations.createdAt, input.dateFrom))
    if (input.dateTo) conditions.push(lte(escalations.createdAt, input.dateTo))

    const where = and(...conditions)

    const [result] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        openCount: sql<number>`count(*) filter (where ${escalations.status} = 'open')::int`,
        inProgressCount: sql<number>`count(*) filter (where ${escalations.status} = 'in_progress')::int`,
        resolvedCount: sql<number>`count(*) filter (where ${escalations.status} = 'resolved')::int`,
        expiredCount: sql<number>`count(*) filter (where ${escalations.status} = 'expired')::int`,
        breachedCount: sql<number>`count(*) filter (where ${escalations.slaBreached} = true)::int`,
        avgResolutionMinutes: sql<number>`round(avg(extract(epoch from (${escalations.resolvedAt} - ${escalations.createdAt})) / 60) filter (where ${escalations.resolvedAt} is not null))::int`,
        lowCount: sql<number>`count(*) filter (where ${escalations.priority} = 'low')::int`,
        mediumCount: sql<number>`count(*) filter (where ${escalations.priority} = 'medium')::int`,
        highCount: sql<number>`count(*) filter (where ${escalations.priority} = 'high')::int`,
        criticalCount: sql<number>`count(*) filter (where ${escalations.priority} = 'critical')::int`,
      })
      .from(escalations)
      .where(where)

    return {
      total: result?.total ?? 0,
      openCount: result?.openCount ?? 0,
      inProgressCount: result?.inProgressCount ?? 0,
      resolvedCount: result?.resolvedCount ?? 0,
      expiredCount: result?.expiredCount ?? 0,
      slaBreachedCount: result?.breachedCount ?? 0,
      avgResolutionMinutes: result?.avgResolutionMinutes ?? null,
      byPriority: {
        low: result?.lowCount ?? 0,
        medium: result?.mediumCount ?? 0,
        high: result?.highCount ?? 0,
        critical: result?.criticalCount ?? 0,
      },
    }
  }

  // ─── SLA Breach Check (for cron) ──────────────────────

  async checkSlaBreaches() {
    const now = new Date()

    const breached = await this.db
      .update(escalations)
      .set({ slaBreached: true, updatedAt: now })
      .where(
        and(
          eq(escalations.slaBreached, false),
          isNotNull(escalations.slaDeadline),
          lte(escalations.slaDeadline, now),
          sql`${escalations.status} IN ('open', 'in_progress')`,
        ),
      )
      .returning()

    return { breachedCount: breached.length, escalationIds: breached.map((e) => e.id) }
  }

  // ─── Helpers ───────────────────────────────────────────

  private async pickRoundRobinUser(
    workspaceId: string,
    role: string,
  ): Promise<string | null> {
    // Find all workspace members with the target role
    const roleMembers = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.workspaceId, workspaceId),
          sql`${members.role} = ${role}`,
          isNotNull(members.acceptedAt),
        ),
      )

    if (roleMembers.length === 0) return null

    // Find the member with fewest open escalations
    const memberUserIds = roleMembers.map((m) => m.userId)

    const counts = await this.db
      .select({
        userId: escalations.assignedToUserId,
        count: sql<number>`count(*)::int`,
      })
      .from(escalations)
      .where(
        and(
          eq(escalations.workspaceId, workspaceId),
          sql`${escalations.status} IN ('open', 'in_progress')`,
          sql`${escalations.assignedToUserId} = ANY(${memberUserIds})`,
        ),
      )
      .groupBy(escalations.assignedToUserId)

    const countMap = new Map(counts.map((c) => [c.userId, c.count]))

    // Pick the user with the fewest open escalations
    let minCount = Infinity
    let pickedUserId: string | null = null
    for (const uid of memberUserIds) {
      const c = countMap.get(uid) ?? 0
      if (c < minCount) {
        minCount = c
        pickedUserId = uid
      }
    }

    return pickedUserId
  }

  // ─── Ticket System ────────────────────────────────────

  private async generateTicketNumber(workspaceId: string): Promise<number> {
    const result = await this.db
      .select({ maxTicket: sql<number>`COALESCE(MAX(${escalations.ticketNumber}), 0)` })
      .from(escalations)
      .where(eq(escalations.workspaceId, workspaceId))
    return (result[0]?.maxTicket ?? 0) + 1
  }

  async addNote(
    input: { workspaceId: string; escalationId: string; text: string },
    userId: string,
    userName: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const esc = await this.db.query.escalations.findFirst({
      where: and(
        eq(escalations.id, input.escalationId),
        eq(escalations.workspaceId, input.workspaceId),
      ),
    })

    if (!esc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation not found' })
    }

    const currentLog = (esc.activityLog ?? []) as Array<{ text: string; authorId: string; authorName: string; timestamp: string }>
    const newEntry = { text: input.text, authorId: userId, authorName: userName, timestamp: new Date().toISOString() }

    const [updated] = await this.db
      .update(escalations)
      .set({
        activityLog: [...currentLog, newEntry],
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, input.escalationId))
      .returning()

    return updated
  }

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
