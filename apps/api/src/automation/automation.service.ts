import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, lte, sql, desc, count, gt, gte, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import type { Database } from '@rectangled/db'
import { automationRules, automationQueue, members, reviews, reviewResponses, connectorInstances, workspaces, customers } from '@rectangled/db'
import { GbpAdapter } from '../connector/adapters/gbp.adapter'
import { buildTriggerKey } from './triggerKey'

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'OptimizerV6 - Rectangled.io',
  },
})

const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini'

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name)

  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly gbpAdapter: GbpAdapter,
  ) {}

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
      cooldownHours?: number | null
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
        cooldownHours: input.cooldownHours ?? null,
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
      cooldownHours?: number | null
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
    if (input.cooldownHours !== undefined) setValues.cooldownHours = input.cooldownHours

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

    // Phase 0 Fix 1: deterministic per-source key for idempotent enqueue.
    // The same triggerKey + same rule cannot be enqueued twice (partial unique
    // index on (rule_id, trigger_key)). null-safe: keys we can't construct
    // (e.g. context with no source ids) skip the dedup, matching prior behaviour.
    const triggerKey = buildTriggerKey(context)

    const queueEntries: Array<typeof automationQueue.$inferSelect> = []

    for (const rule of filteredRules) {
      // Phase 0 Fix 4 — per-rule cooldown. Skip enqueue if the same
      // (rule, customer) was queued within the cooldown window (regardless
      // of status — pending/processing/completed all count as "served
      // recently"; only cancelled/failed don't reset the clock).
      if (rule.cooldownHours && context.customerId) {
        const cutoff = new Date(Date.now() - rule.cooldownHours * 60 * 60 * 1000)
        const recent = await this.db
          .select({ id: automationQueue.id })
          .from(automationQueue)
          .where(
            and(
              eq(automationQueue.ruleId, rule.id),
              eq(automationQueue.customerId, context.customerId),
              gte(automationQueue.createdAt, cutoff),
              inArray(automationQueue.status, ['pending', 'processing', 'completed'] as any),
            ),
          )
          .limit(1)
        if (recent.length > 0) {
          this.logger.log(
            `Cooldown skip: rule "${rule.name}" was triggered for customer ${context.customerId} within ${rule.cooldownHours}h`,
          )
          continue
        }
      }

      const scheduledFor = new Date(Date.now() + rule.delayMinutes * 60 * 1000)

      const [entry] = await this.db
        .insert(automationQueue)
        .values({
          ruleId: rule.id,
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          journeyResponseId: context.journeyResponseId,
          reviewId: context.reviewId,
          triggerKey,
          scheduledFor,
          status: 'pending' as any,
          metadata: context.metadata || {},
        })
        .onConflictDoNothing({
          target: [automationQueue.ruleId, automationQueue.triggerKey],
        })
        .returning()

      // entry is undefined when the row was a duplicate and was skipped.
      if (entry) queueEntries.push(entry)
    }

    return { triggered: queueEntries.length, entries: queueEntries }
  }

  /**
   * Phase 0 Fix 8 — workspace-level customer rate cap check.
   *
   * Returns null if the action is allowed; returns a reason string if it
   * should be cancelled. Caller (queue worker) marks the row 'cancelled'
   * with the reason instead of dispatching.
   */
  private async checkCustomerRateCap(queueItem: {
    workspaceId: string
    customerId: string | null
    rule: { actionType: string }
  }): Promise<string | null> {
    if (!queueItem.customerId) return null
    const ws = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, queueItem.workspaceId),
    })
    const cap = (ws?.settings as any)?.customerRateCap as
      | { maxMessagesPerDay?: number; maxCouponsPerMonth?: number; maxActionsPerWeek?: number }
      | undefined
    if (!cap) return null

    const now = Date.now()

    // maxActionsPerWeek — total completed actions of any kind for this customer
    if (cap.maxActionsPerWeek && cap.maxActionsPerWeek > 0) {
      const since = new Date(now - 7 * 24 * 60 * 60 * 1000)
      const [{ c }] = await this.db
        .select({ c: count() })
        .from(automationQueue)
        .where(
          and(
            eq(automationQueue.customerId, queueItem.customerId),
            eq(automationQueue.status, 'completed' as any),
            gte(automationQueue.completedAt, since),
          ),
        )
      if (c >= cap.maxActionsPerWeek) {
        return `customer_rate_cap: maxActionsPerWeek=${cap.maxActionsPerWeek} reached`
      }
    }

    const isMessage = queueItem.rule.actionType === 'send_message' || queueItem.rule.actionType === 'send_coupon'
    if (isMessage && cap.maxMessagesPerDay && cap.maxMessagesPerDay > 0) {
      const since = new Date(now - 24 * 60 * 60 * 1000)
      const [{ c }] = await this.db
        .select({ c: count() })
        .from(automationQueue)
        .innerJoin(automationRules, eq(automationQueue.ruleId, automationRules.id))
        .where(
          and(
            eq(automationQueue.customerId, queueItem.customerId),
            eq(automationQueue.status, 'completed' as any),
            gte(automationQueue.completedAt, since),
            inArray(automationRules.actionType, ['send_message', 'send_coupon'] as any),
          ),
        )
      if (c >= cap.maxMessagesPerDay) {
        return `customer_rate_cap: maxMessagesPerDay=${cap.maxMessagesPerDay} reached`
      }
    }

    if (queueItem.rule.actionType === 'send_coupon' && cap.maxCouponsPerMonth && cap.maxCouponsPerMonth > 0) {
      const since = new Date(now - 30 * 24 * 60 * 60 * 1000)
      const [{ c }] = await this.db
        .select({ c: count() })
        .from(automationQueue)
        .innerJoin(automationRules, eq(automationQueue.ruleId, automationRules.id))
        .where(
          and(
            eq(automationQueue.customerId, queueItem.customerId),
            eq(automationQueue.status, 'completed' as any),
            gte(automationQueue.completedAt, since),
            eq(automationRules.actionType, 'send_coupon' as any),
          ),
        )
      if (c >= cap.maxCouponsPerMonth) {
        return `customer_rate_cap: maxCouponsPerMonth=${cap.maxCouponsPerMonth} reached`
      }
    }

    return null
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

      // Phase 0 Fix 8 — customer rate cap. Check BEFORE marking 'processing'
      // so a capped row doesn't get retried by the watchdog. If capped,
      // mark 'cancelled' with the reason in lastError.
      const rateCapReason = await this.checkCustomerRateCap({
        workspaceId: item.workspaceId,
        customerId: item.customerId,
        rule: item.rule as { actionType: string },
      })
      if (rateCapReason) {
        await this.db
          .update(automationQueue)
          .set({
            status: 'cancelled' as any,
            lastError: rateCapReason,
            updatedAt: new Date(),
          })
          .where(eq(automationQueue.id, item.id))
        this.logger.log(`Cancelled queue ${item.id}: ${rateCapReason}`)
        continue
      }

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

  /**
   * Phase 0 Fix 9: stable idempotency key per (queueItemId, attempts).
   * Re-running the same attempt produces the same key; a retry (new attempt)
   * produces a different key. This is what we pass to outbound calls (GBP,
   * WapiSnap, OpenRouter) so they can de-duplicate at their end if supported.
   */
  private idempotencyKeyFor(queueItem: { id: string; attempts: number }): string {
    return `auto-${queueItem.id}-${queueItem.attempts}`
  }

  private async executeAction(queueItem: any) {
    const rule = queueItem.rule
    if (!rule) return

    this.logger.log(
      `Executing action: ${rule.actionType} for rule "${rule.name}" (queue: ${queueItem.id})`
    )

    switch (rule.actionType) {
      case 'ai_reply_review':
        await this.executeAiReplyToReview(queueItem)
        break
      default:
        // Stub for other action types
        this.logger.log(`Action type "${rule.actionType}" is not yet implemented`)
        break
    }
  }

  /**
   * Execute the AI Reply to Review action:
   * 1. Load the review from DB
   * 2. Check rating filter from actionConfig
   * 3. Generate an AI reply via the AI response service
   * 4. Post the reply to Google via the GBP adapter
   */
  private async executeAiReplyToReview(queueItem: any) {
    const rule = queueItem.rule
    const actionConfig = (rule?.actionConfig ?? {}) as Record<string, unknown>
    const reviewId = queueItem.reviewId

    if (!reviewId) {
      throw new Error('No reviewId associated with this queue item')
    }

    // 1. Load the review
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    // 2. Check rating filter
    const ratingFilter = (actionConfig.ratingFilter as string) ?? 'all'
    if (ratingFilter === 'positive' && review.rating < 4) {
      this.logger.log(`Skipping AI reply: review rating ${review.rating} does not match filter "positive"`)
      return
    }
    if (ratingFilter === 'negative' && review.rating > 3) {
      this.logger.log(`Skipping AI reply: review rating ${review.rating} does not match filter "negative"`)
      return
    }

    // 3. Generate AI reply
    const tone = (actionConfig.tone as string) ?? 'professional'
    const includeBusinessName = actionConfig.includeBusinessName !== false
    const maxLength = (actionConfig.maxLength as string) ?? 'medium'

    const maxTokensMap: Record<string, number> = {
      short: 80,
      medium: 150,
      long: 250,
    }

    // Fetch workspace name for business context
    let businessName = 'our business'
    if (includeBusinessName) {
      const workspace = await this.db.query.workspaces.findFirst({
        where: eq(workspaces.id, review.workspaceId),
      })
      if (workspace?.name) {
        businessName = workspace.name
      }
    }

    let replyText: string

    // Try AI generation, fall back to template
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const toneDesc = tone === 'professional' ? 'professional and polished'
          : tone === 'friendly' ? 'warm, friendly and approachable'
          : 'casual and conversational'

        const wordLimit = maxLength === 'short' ? 50 : maxLength === 'long' ? 150 : 100

        const systemPrompt = `You are a review response writer for "${businessName}". Write responses that sound like a real human business owner, NOT like an AI.

Rules:
- Tone: ${toneDesc}
- Keep it under ${wordLimit} words.
- NEVER use phrases like "I'm sorry to hear" or "Thank you for your valuable feedback" - these scream AI.
- Use natural language with slight imperfections (contractions, occasional informal phrasing).
- Address specific points from the review when possible.
- For negative reviews: acknowledge the issue, take responsibility, offer to make it right.
- For positive reviews: be genuinely grateful, mention something specific they liked.
- If the reviewer name is available, use their first name naturally (not in every sentence).
- Do NOT use emojis unless the tone is "friendly" (max 1 emoji).
- Do NOT include a sign-off like "Best regards" or "Sincerely" - just end naturally.
- ${includeBusinessName ? `Mention "${businessName}" naturally once.` : 'Do NOT mention any business name.'}`

        const reviewText = review.text || '(no text, just a rating)'
        const reviewerName = review.reviewerName || 'the customer'

        const userPrompt = `Review from ${reviewerName} (${review.rating}/5 stars):
"${reviewText}"

Write a response:`

        const completion = await openrouter.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokensMap[maxLength] ?? 150,
          temperature: 0.85,
        })

        replyText = completion.choices[0]?.message?.content?.trim() || ''
      } catch (aiErr) {
        this.logger.warn(`AI generation failed, using template fallback: ${aiErr}`)
        replyText = ''
      }
    } else {
      replyText = ''
    }

    // Fallback to template if AI generation failed or returned empty
    if (!replyText) {
      const isPositive = review.rating >= 4
      const name = review.reviewerName ? `, ${review.reviewerName.split(' ')[0]}` : ''
      replyText = isPositive
        ? `Thank you for your wonderful review${name}! We're thrilled to hear about your positive experience${includeBusinessName ? ` at ${businessName}` : ''}. We look forward to serving you again.`
        : `Thank you for your feedback${name}. We're sorry your experience${includeBusinessName ? ` at ${businessName}` : ''} didn't meet expectations. We'd love the opportunity to make things right.`
    }

    // 4. Post the reply to Google via GBP adapter
    // Find the connector instance for this review's location to get access token
    const connector = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.workspaceId, review.workspaceId),
        eq(connectorInstances.connectorTypeId, 'gbp'),
        eq(connectorInstances.status, 'active' as any),
      ),
    })

    if (!connector) {
      throw new Error('No active GBP connector found for this workspace')
    }

    const credentials = connector.credentials as Record<string, unknown>
    let accessToken = credentials.accessToken as string

    if (!accessToken) {
      throw new Error('No access token in GBP connector credentials')
    }

    // Check if token might be expired and refresh if possible
    const expiresAt = credentials.expiresAt as string
    if (expiresAt && new Date(expiresAt) < new Date()) {
      const refreshToken = credentials.refreshToken as string
      if (refreshToken) {
        try {
          const refreshed = await this.gbpAdapter.refreshAccessToken(refreshToken)
          accessToken = refreshed.accessToken

          // Update stored credentials
          await this.db
            .update(connectorInstances)
            .set({
              credentials: {
                ...credentials,
                accessToken: refreshed.accessToken,
                expiresAt: refreshed.expiresAt,
              },
              updatedAt: new Date(),
            })
            .where(eq(connectorInstances.id, connector.id))
        } catch (refreshErr) {
          this.logger.error(`Failed to refresh GBP token: ${refreshErr}`)
          throw new Error('GBP access token expired and refresh failed')
        }
      }
    }

    // Phase 0 Fix 2 — AI reply approval gate.
    //
    // Default behaviour (requireApproval defaults TRUE for safety): reviews
    // below autoApproveMinRating get inserted into reviewResponses as a draft
    // with generatedBy='ai' and status='draft'. The owner reviews it in the
    // inbox and approves manually. Reviews at/above the auto-approve cutoff
    // are posted automatically.
    //
    // This stops one bad AI reply on a 1-star review from causing public
    // brand damage. The cost is operator workload — the inbox UI surfaces
    // pending AI drafts so owners can act in seconds.
    const requireApproval = actionConfig.requireApproval !== false  // default true
    const autoApproveMinRating = (actionConfig.autoApproveMinRating as number) ?? 5
    const shouldAutoPost = !requireApproval || review.rating >= autoApproveMinRating

    // Always insert a row in reviewResponses to track the draft. Status =
    // 'posted' if we're about to call GBP, 'draft' if we're parking for review.
    const draftStatus = shouldAutoPost ? ('approved' as const) : ('draft' as const)
    const [draftRow] = await this.db
      .insert(reviewResponses)
      .values({
        reviewId,
        content: replyText,
        status: draftStatus,
        generatedBy: 'ai',
        aiModel: AI_MODEL,
        metadata: { queueItemId: queueItem.id, ratingAtGeneration: review.rating },
      })
      .returning()

    if (!shouldAutoPost) {
      this.logger.log(
        `AI draft ${draftRow.id} for review ${reviewId} (rating ${review.rating}) saved as 'draft' for manual approval (requireApproval=${requireApproval}, autoApproveMinRating=${autoApproveMinRating})`,
      )
      // Work item complete — operator owns the next step from the inbox.
      // No notification here yet (Phase 4 will add an event-bus notification);
      // the inbox queries pending drafts on every list call.
      return
    }

    // shouldAutoPost === true: continue and post to GBP.
    const reviewMetadata = (review.metadata ?? {}) as Record<string, unknown>
    const reviewResourceName = reviewMetadata.gbpReviewName as string
      || reviewMetadata.reviewName as string
      || reviewMetadata.name as string

    if (!reviewResourceName) {
      throw new Error('No GBP review resource name found in review metadata. Cannot post reply.')
    }

    // Post the reply (Phase 0 Fix 9: idempotency key — GBP's PUT is already
    // idempotent so this is mostly trace-tagging, but we pass it through for
    // consistency with WapiSnap / OpenRouter call sites).
    const idempotencyKey = this.idempotencyKeyFor(queueItem)
    await this.gbpAdapter.replyToReview(accessToken, reviewResourceName, replyText, {
      idempotencyKey,
    })

    // Mark our draft row as posted now that GBP accepted it.
    await this.db
      .update(reviewResponses)
      .set({
        status: 'posted',
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, draftRow.id))

    this.logger.log(
      `AI reply posted to Google review ${reviewId} (resource: ${reviewResourceName}, idem: ${idempotencyKey})`
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
