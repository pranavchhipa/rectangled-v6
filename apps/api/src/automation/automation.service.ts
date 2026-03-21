import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, lte, sql, desc, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import { automationRules, automationQueue, members } from '@rectangled/db'

@Injectable()
export class AutomationService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // --- Rule CRUD ---

  async listRules(workspaceId: string, userId: string, journeyId?: string) {
    await this.requireMembership(workspaceId, userId)
    const conditions = [eq(automationRules.workspaceId, workspaceId)]
    if (journeyId) conditions.push(eq(automationRules.journeyId, journeyId))

    return this.db.query.automationRules.findMany({
      where: and(...conditions),
      orderBy: [desc(automationRules.createdAt)],
    })
  }

  async createRule(
    input: {
      workspaceId: string
      journeyId?: string
      name: string
      triggerEvent: string
      delayMinutes: number
      actionType: string
      actionConfig: Record<string, unknown>
      conditions?: Record<string, unknown>
      isActive?: boolean
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const [rule] = await this.db
      .insert(automationRules)
      .values({
        workspaceId: input.workspaceId,
        journeyId: input.journeyId,
        name: input.name.trim(),
        triggerEvent: input.triggerEvent as any,
        delayMinutes: input.delayMinutes,
        actionType: input.actionType as any,
        actionConfig: input.actionConfig,
        conditions: input.conditions,
        isActive: input.isActive ?? true,
      })
      .returning()

    return rule
  }

  async updateRule(
    input: {
      workspaceId: string
      ruleId: string
      journeyId?: string
      name?: string
      triggerEvent?: string
      delayMinutes?: number
      actionType?: string
      actionConfig?: Record<string, unknown>
      conditions?: Record<string, unknown>
      isActive?: boolean
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)
    const rule = await this.findRuleOrThrow(input.ruleId, input.workspaceId)

    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) setValues.name = input.name.trim()
    if (input.journeyId !== undefined) setValues.journeyId = input.journeyId
    if (input.triggerEvent !== undefined) setValues.triggerEvent = input.triggerEvent
    if (input.delayMinutes !== undefined) setValues.delayMinutes = input.delayMinutes
    if (input.actionType !== undefined) setValues.actionType = input.actionType
    if (input.actionConfig !== undefined) setValues.actionConfig = input.actionConfig
    if (input.conditions !== undefined) setValues.conditions = input.conditions
    if (input.isActive !== undefined) setValues.isActive = input.isActive

    const [updated] = await this.db
      .update(automationRules)
      .set(setValues)
      .where(eq(automationRules.id, input.ruleId))
      .returning()

    return updated
  }

  async deleteRule(workspaceId: string, ruleId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    await this.findRuleOrThrow(ruleId, workspaceId)
    await this.db.delete(automationRules).where(eq(automationRules.id, ruleId))
    return { success: true }
  }

  // --- Trigger & Queue ---

  async triggerAutomation(context: {
    workspaceId: string
    event: string
    journeyId?: string
    customerId?: string
    journeyResponseId?: string
    reviewId?: string
    metadata?: Record<string, unknown>
  }) {
    // Find active rules matching this event
    const conditions = [
      eq(automationRules.workspaceId, context.workspaceId),
      eq(automationRules.triggerEvent, context.event as any),
      eq(automationRules.isActive, true),
    ]

    // If journeyId provided, match rules for that journey or global rules (journeyId IS NULL)
    const matchingRules = await this.db.query.automationRules.findMany({
      where: and(...conditions),
    })

    const filteredRules = matchingRules.filter((rule) => {
      // Rule is global (no journeyId) or matches the specific journey
      if (rule.journeyId && context.journeyId && rule.journeyId !== context.journeyId) {
        return false
      }
      return true
    })

    const queueEntries = []

    for (const rule of filteredRules) {
      const scheduledFor = new Date(Date.now() + rule.delayMinutes * 60 * 1000)

      const [entry] = await this.db
        .insert(automationQueue)
        .values({
          ruleId: rule.id,
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          journeyResponseId: context.journeyResponseId,
          reviewId: context.reviewId,
          scheduledFor,
          status: 'pending' as any,
          metadata: context.metadata || {},
        })
        .returning()

      queueEntries.push(entry)
    }

    return { triggered: queueEntries.length, entries: queueEntries }
  }

  async processQueue() {
    const now = new Date()

    // Find all pending items where scheduledFor <= now
    const pendingItems = await this.db.query.automationQueue.findMany({
      where: and(
        eq(automationQueue.status, 'pending' as any),
        lte(automationQueue.scheduledFor, now)
      ),
      with: { rule: true },
    })

    const results = { processed: 0, succeeded: 0, failed: 0 }

    for (const item of pendingItems) {
      results.processed++

      // Mark as processing
      await this.db
        .update(automationQueue)
        .set({ status: 'processing' as any, attempts: item.attempts + 1, updatedAt: new Date() })
        .where(eq(automationQueue.id, item.id))

      try {
        // Execute the action (stub for now)
        await this.executeAction(item)

        // Mark as completed
        await this.db
          .update(automationQueue)
          .set({ status: 'completed' as any, completedAt: new Date(), updatedAt: new Date() })
          .where(eq(automationQueue.id, item.id))

        results.succeeded++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await this.db
          .update(automationQueue)
          .set({ status: 'failed' as any, lastError: errorMessage, updatedAt: new Date() })
          .where(eq(automationQueue.id, item.id))

        results.failed++
      }
    }

    return results
  }

  async listQueue(
    workspaceId: string,
    userId: string,
    options?: { status?: string; page?: number; limit?: number }
  ) {
    await this.requireMembership(workspaceId, userId)

    const page = options?.page || 1
    const limit = options?.limit || 25
    const offset = (page - 1) * limit

    const conditions = [eq(automationQueue.workspaceId, workspaceId)]
    if (options?.status) {
      conditions.push(eq(automationQueue.status, options.status as any))
    }

    const items = await this.db.query.automationQueue.findMany({
      where: and(...conditions),
      orderBy: [desc(automationQueue.scheduledFor)],
      limit,
      offset,
      with: { rule: true },
    })

    return { items, page, limit }
  }

  async cancelQueued(workspaceId: string, queueId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const item = await this.db.query.automationQueue.findFirst({
      where: and(
        eq(automationQueue.id, queueId),
        eq(automationQueue.workspaceId, workspaceId)
      ),
    })

    if (!item) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Queue item not found' })
    }

    if (item.status !== 'pending') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only cancel pending items' })
    }

    const [updated] = await this.db
      .update(automationQueue)
      .set({ status: 'cancelled' as any, updatedAt: new Date() })
      .where(eq(automationQueue.id, queueId))
      .returning()

    return updated
  }

  async getStats(
    workspaceId: string,
    userId: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    await this.requireMembership(workspaceId, userId)

    const conditions = [eq(automationQueue.workspaceId, workspaceId)]
    if (dateFrom) {
      conditions.push(sql`${automationQueue.createdAt} >= ${new Date(dateFrom)}` as any)
    }
    if (dateTo) {
      conditions.push(sql`${automationQueue.createdAt} <= ${new Date(dateTo)}` as any)
    }

    const allItems = await this.db.query.automationQueue.findMany({
      where: and(...conditions),
      with: { rule: true },
    })

    const stats = {
      total: allItems.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      byActionType: {} as Record<string, number>,
    }

    for (const item of allItems) {
      const status = item.status as keyof typeof stats
      if (typeof stats[status] === 'number') {
        (stats[status] as number)++
      }
      if (item.rule) {
        const actionType = (item.rule as any).actionType as string
        stats.byActionType[actionType] = (stats.byActionType[actionType] || 0) + 1
      }
    }

    return stats
  }

  async seedDefaultRules(workspaceId: string, journeyId: string) {
    const defaults = [
      {
        workspaceId,
        journeyId,
        name: 'Thank positive reviewers',
        triggerEvent: 'journey_completed_positive' as const,
        delayMinutes: 4320, // 3 days
        actionType: 'send_message' as const,
        actionConfig: { channel: 'email', templateId: 'thank_positive' },
        isActive: true,
      },
      {
        workspaceId,
        journeyId,
        name: 'Win-back negative reviewers',
        triggerEvent: 'journey_completed_negative' as const,
        delayMinutes: 1440, // 1 day
        actionType: 'send_coupon' as const,
        actionConfig: { couponTemplateId: 'default_winback' },
        isActive: true,
      },
      {
        workspaceId,
        journeyId,
        name: 'Remind abandoned journeys',
        triggerEvent: 'journey_abandoned' as const,
        delayMinutes: 120, // 2 hours
        actionType: 'send_message' as const,
        actionConfig: { channel: 'whatsapp', templateId: 'journey_reminder' },
        isActive: true,
      },
    ]

    const inserted = await this.db.insert(automationRules).values(defaults).returning()
    return inserted
  }

  // --- Private helpers ---

  private async executeAction(queueItem: any) {
    // Stub implementation — log and mark complete
    // Future: dispatch to actual action handlers based on rule.actionType
    const rule = queueItem.rule
    if (!rule) return

    console.log(
      `[Automation] Executing action: ${rule.actionType} for rule "${rule.name}" (queue: ${queueItem.id})`
    )
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace' })
    }
    return membership
  }

  private async findRuleOrThrow(ruleId: string, workspaceId: string) {
    const rule = await this.db.query.automationRules.findFirst({
      where: and(
        eq(automationRules.id, ruleId),
        eq(automationRules.workspaceId, workspaceId)
      ),
    })
    if (!rule) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Automation rule not found' })
    }
    return rule
  }
}
