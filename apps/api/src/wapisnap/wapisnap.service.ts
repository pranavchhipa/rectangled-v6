import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, lte, sql, desc, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import {
  wapisnapWorkspaces,
  wapisnapTemplates,
  wapisnapMessages,
  wapisnapSequences,
  members,
  locations,
} from '@rectangled/db'
import { WapisnapClientService } from './wapisnap-client.service'

@Injectable()
export class WapisnapService {
  private readonly logger = new Logger(WapisnapService.name)

  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly client: WapisnapClientService
  ) {}

  // --- Provisioning ---

  async provisionForLocation(locationId: string, userId: string) {
    // Get location to find workspace and name
    const location = await this.db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    })
    if (!location) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Location not found' })
    }

    await this.requireMembership(location.workspaceId, userId)

    // Check if already provisioned
    const existing = await this.db.query.wapisnapWorkspaces.findFirst({
      where: eq(wapisnapWorkspaces.locationId, locationId),
    })
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'WapiSnap workspace already provisioned for this location',
      })
    }

    // Provision via bridge
    const result = await this.client.provision(location.name, location.timezone)

    // Store in DB
    const [workspace] = await this.db
      .insert(wapisnapWorkspaces)
      .values({
        locationId,
        workspaceId: result.workspaceId,
        apiKey: result.apiKey,
        numberStatus: 'pending' as any,
        isActive: true,
        provisionedAt: new Date(),
      })
      .returning()

    return workspace
  }

  async getWorkspaceForLocation(locationId: string) {
    const workspace = await this.db.query.wapisnapWorkspaces.findFirst({
      where: eq(wapisnapWorkspaces.locationId, locationId),
    })
    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No WapiSnap workspace found for this location',
      })
    }
    return workspace
  }

  // --- Messaging ---

  async sendReviewRequest(
    locationId: string,
    phone: string,
    customerName: string,
    journeyLink: string
  ) {
    const ws = await this.getWorkspaceForLocation(locationId)
    this.assertActive(ws)

    const variables = {
      '1': customerName,
      '2': journeyLink,
    }

    const result = await this.client.sendTemplate(
      ws.apiKey,
      phone,
      'review_request',
      variables
    )

    // Track message
    await this.db.insert(wapisnapMessages).values({
      wapisnapWorkspaceId: ws.id,
      phone,
      direction: 'outbound' as any,
      type: 'template' as any,
      templateName: 'review_request',
      variables,
      status: 'sent' as any,
      metaMessageId: result.messageId,
      sentAt: new Date(),
    })

    return result
  }

  async sendCoupon(
    locationId: string,
    phone: string,
    customerName: string,
    couponCode: string,
    discount: string
  ) {
    const ws = await this.getWorkspaceForLocation(locationId)
    this.assertActive(ws)

    const variables = {
      '1': customerName,
      '2': couponCode,
      '3': discount,
    }

    const result = await this.client.sendTemplate(
      ws.apiKey,
      phone,
      'coupon_delivery',
      variables
    )

    await this.db.insert(wapisnapMessages).values({
      wapisnapWorkspaceId: ws.id,
      phone,
      direction: 'outbound' as any,
      type: 'template' as any,
      templateName: 'coupon_delivery',
      variables,
      status: 'sent' as any,
      metaMessageId: result.messageId,
      sentAt: new Date(),
    })

    return result
  }

  async sendFollowUp(locationId: string, phone: string, customerName: string, message: string) {
    const ws = await this.getWorkspaceForLocation(locationId)
    this.assertActive(ws)

    const result = await this.client.sendText(ws.apiKey, phone, message)

    await this.db.insert(wapisnapMessages).values({
      wapisnapWorkspaceId: ws.id,
      phone,
      direction: 'outbound' as any,
      type: 'text' as any,
      status: 'sent' as any,
      metaMessageId: result.messageId,
      sentAt: new Date(),
    })

    return result
  }

  // --- Sequences ---

  async createSequence(
    workspaceId: string,
    customerId: string | undefined,
    phone: string,
    steps: Array<{
      action: string
      templateName?: string
      variables?: Record<string, unknown>
      text?: string
      delayAfter: number
    }>
  ) {
    // First step executes immediately, so nextExecuteAt = now
    const [sequence] = await this.db
      .insert(wapisnapSequences)
      .values({
        workspaceId,
        customerId: customerId || null,
        phone,
        status: 'active' as any,
        steps: steps.map((s) => ({ ...s, executedAt: undefined })),
        currentStep: 0,
        nextExecuteAt: new Date(),
      })
      .returning()

    return sequence
  }

  async processSequences() {
    const now = new Date()

    const pendingSequences = await this.db.query.wapisnapSequences.findMany({
      where: and(
        eq(wapisnapSequences.status, 'active' as any),
        lte(wapisnapSequences.nextExecuteAt, now)
      ),
    })

    const results = { processed: 0, succeeded: 0, failed: 0 }

    for (const seq of pendingSequences) {
      results.processed++

      try {
        const steps = seq.steps as Array<{
          action: string
          templateName?: string
          variables?: Record<string, unknown>
          text?: string
          delayAfter: number
          executedAt?: string
        }>

        const currentStep = steps[seq.currentStep]
        if (!currentStep) {
          // All steps done
          await this.db
            .update(wapisnapSequences)
            .set({
              status: 'completed' as any,
              completedAt: new Date(),
              nextExecuteAt: null,
              updatedAt: new Date(),
            })
            .where(eq(wapisnapSequences.id, seq.id))
          results.succeeded++
          continue
        }

        // Find the wapisnap workspace for this sequence's workspace
        // We need to look up via workspace -> locations -> wapisnapWorkspaces
        // For sequences, we use the phone to find the right workspace
        const wsLocations = await this.db.query.wapisnapWorkspaces.findMany({
          where: eq(wapisnapWorkspaces.isActive, true),
          with: { location: true },
        })

        // Find a workspace that belongs to this sequence's workspace
        const ws = wsLocations.find(
          (w) => (w.location as any)?.workspaceId === seq.workspaceId
        )

        if (!ws) {
          this.logger.warn(`No active WapiSnap workspace for sequence ${seq.id}`)
          results.failed++
          continue
        }

        // Execute the current step
        if (currentStep.action === 'send_template' && currentStep.templateName) {
          await this.client.sendTemplate(
            ws.apiKey,
            seq.phone,
            currentStep.templateName,
            currentStep.variables || {}
          )
        } else if (currentStep.action === 'send_text' && currentStep.text) {
          await this.client.sendText(ws.apiKey, seq.phone, currentStep.text)
        } else if (currentStep.action === 'send_interactive') {
          // Interactive messages would need buttons from variables
          const buttons = (currentStep.variables?.buttons as Array<{ id: string; title: string }>) || []
          const body = currentStep.text || ''
          await this.client.sendInteractive(ws.apiKey, seq.phone, body, buttons)
        }
        // 'wait' action: just advances with delay

        // Mark step as executed
        steps[seq.currentStep] = { ...currentStep, executedAt: new Date().toISOString() }

        const nextStepIndex = seq.currentStep + 1
        const isComplete = nextStepIndex >= steps.length

        const nextExecuteAt = isComplete
          ? null
          : new Date(Date.now() + currentStep.delayAfter * 60 * 1000)

        await this.db
          .update(wapisnapSequences)
          .set({
            steps,
            currentStep: nextStepIndex,
            nextExecuteAt,
            status: isComplete ? ('completed' as any) : ('active' as any),
            completedAt: isComplete ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(eq(wapisnapSequences.id, seq.id))

        results.succeeded++
      } catch (error) {
        this.logger.error(
          `Failed to process sequence ${seq.id}: ${error instanceof Error ? error.message : 'Unknown'}`
        )
        results.failed++
      }
    }

    return results
  }

  async cancelSequence(sequenceId: string, userId: string) {
    const sequence = await this.db.query.wapisnapSequences.findFirst({
      where: eq(wapisnapSequences.id, sequenceId),
    })
    if (!sequence) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' })
    }

    await this.requireMembership(sequence.workspaceId, userId)

    if (sequence.status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Can only cancel active sequences',
      })
    }

    const [updated] = await this.db
      .update(wapisnapSequences)
      .set({
        status: 'cancelled' as any,
        cancelledAt: new Date(),
        nextExecuteAt: null,
        updatedAt: new Date(),
      })
      .where(eq(wapisnapSequences.id, sequenceId))
      .returning()

    return updated
  }

  // --- Templates ---

  async syncTemplates(locationId: string) {
    const ws = await this.getWorkspaceForLocation(locationId)
    const remoteTemplates = await this.client.listTemplates(ws.apiKey)

    for (const remote of remoteTemplates) {
      const existing = await this.db.query.wapisnapTemplates.findFirst({
        where: and(
          eq(wapisnapTemplates.wapisnapWorkspaceId, ws.id),
          eq(wapisnapTemplates.name, remote.name),
          eq(wapisnapTemplates.language, remote.language)
        ),
      })

      if (existing) {
        await this.db
          .update(wapisnapTemplates)
          .set({
            status: remote.status as any,
            components: remote.components,
            metaTemplateId: remote.id,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(wapisnapTemplates.id, existing.id))
      } else {
        await this.db.insert(wapisnapTemplates).values({
          wapisnapWorkspaceId: ws.id,
          name: remote.name,
          language: remote.language,
          category: remote.category as any,
          status: remote.status as any,
          components: remote.components,
          metaTemplateId: remote.id,
          lastSyncAt: new Date(),
        })
      }
    }

    return { synced: remoteTemplates.length }
  }

  async listTemplates(locationId: string) {
    const ws = await this.getWorkspaceForLocation(locationId)
    return this.db.query.wapisnapTemplates.findMany({
      where: eq(wapisnapTemplates.wapisnapWorkspaceId, ws.id),
      orderBy: [desc(wapisnapTemplates.updatedAt)],
    })
  }

  // --- Contacts ---

  async tagContact(locationId: string, phone: string, tags: string[]) {
    const ws = await this.getWorkspaceForLocation(locationId)
    this.assertActive(ws)

    // Try to get existing contact, create if not found
    try {
      const contact = await this.client.getContact(ws.apiKey, phone)
      if (contact?.id) {
        await this.client.addTags(ws.apiKey, contact.id, tags)
        return { success: true, contactId: contact.id }
      }
    } catch {
      // Contact doesn't exist, create it
    }

    const created = await this.client.createContact(ws.apiKey, phone, '', tags)
    return { success: true, contactId: created.contactId }
  }

  // --- Analytics ---

  async getDeliveryStats(locationId: string, dateRange?: { from?: string; to?: string }) {
    const ws = await this.getWorkspaceForLocation(locationId)

    const conditions = [eq(wapisnapMessages.wapisnapWorkspaceId, ws.id)]
    if (dateRange?.from) {
      conditions.push(
        sql`${wapisnapMessages.createdAt} >= ${new Date(dateRange.from)}` as any
      )
    }
    if (dateRange?.to) {
      conditions.push(
        sql`${wapisnapMessages.createdAt} <= ${new Date(dateRange.to)}` as any
      )
    }

    const messages = await this.db.query.wapisnapMessages.findMany({
      where: and(...conditions),
    })

    const stats = {
      total: messages.length,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      byType: {} as Record<string, number>,
      deliveryRate: 0,
      readRate: 0,
    }

    for (const msg of messages) {
      const status = msg.status as string
      if (status in stats && typeof (stats as any)[status] === 'number') {
        ;(stats as any)[status]++
      }
      const type = msg.type as string
      stats.byType[type] = (stats.byType[type] || 0) + 1
    }

    const sentOrBetter = stats.sent + stats.delivered + stats.read
    stats.deliveryRate = sentOrBetter > 0 ? (stats.delivered + stats.read) / sentOrBetter : 0
    stats.readRate = sentOrBetter > 0 ? stats.read / sentOrBetter : 0

    return stats
  }

  // --- Kill switch ---

  async pauseLocation(locationId: string, userId: string) {
    const ws = await this.getWorkspaceForLocation(locationId)
    const location = await this.db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    })
    if (location) {
      await this.requireMembership(location.workspaceId, userId)
    }

    await this.client.pauseWorkspace(ws.apiKey)

    const [updated] = await this.db
      .update(wapisnapWorkspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(wapisnapWorkspaces.id, ws.id))
      .returning()

    return updated
  }

  async resumeLocation(locationId: string, userId: string) {
    const ws = await this.getWorkspaceForLocation(locationId)
    const location = await this.db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    })
    if (location) {
      await this.requireMembership(location.workspaceId, userId)
    }

    await this.client.resumeWorkspace(ws.apiKey)

    const [updated] = await this.db
      .update(wapisnapWorkspaces)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(wapisnapWorkspaces.id, ws.id))
      .returning()

    return updated
  }

  // --- Webhook handlers (called from controller) ---

  async handleMessageStatus(data: Record<string, unknown>) {
    const messageId = data.messageId as string
    const status = data.status as string

    if (!messageId || !status) return

    const setValues: Record<string, unknown> = {
      status: status as any,
    }

    if (status === 'sent') setValues.sentAt = new Date()
    if (status === 'delivered') setValues.deliveredAt = new Date()
    if (status === 'read') setValues.readAt = new Date()
    if (status === 'failed') {
      setValues.failedAt = new Date()
      setValues.errorMessage = (data.error as string) || 'Unknown error'
    }

    await this.db
      .update(wapisnapMessages)
      .set(setValues)
      .where(eq(wapisnapMessages.metaMessageId, messageId))
  }

  async handleMessageReceived(
    bridgeWorkspaceId: string,
    data: Record<string, unknown>
  ) {
    // Find our workspace by bridge workspace ID
    const ws = await this.db.query.wapisnapWorkspaces.findFirst({
      where: eq(wapisnapWorkspaces.workspaceId, bridgeWorkspaceId),
    })
    if (!ws) {
      this.logger.warn(`Unknown bridge workspace: ${bridgeWorkspaceId}`)
      return
    }

    await this.db.insert(wapisnapMessages).values({
      wapisnapWorkspaceId: ws.id,
      phone: (data.phone as string) || '',
      direction: 'inbound' as any,
      type: 'text' as any,
      status: 'delivered' as any,
      metaMessageId: (data.messageId as string) || null,
      deliveredAt: new Date(),
    })
  }

  async handleNumberReady(bridgeWorkspaceId: string, data: Record<string, unknown>) {
    const phoneNumber = data.phoneNumber as string
    await this.db
      .update(wapisnapWorkspaces)
      .set({
        numberStatus: 'ready' as any,
        phoneNumber,
        updatedAt: new Date(),
      })
      .where(eq(wapisnapWorkspaces.workspaceId, bridgeWorkspaceId))
  }

  async handleNumberError(bridgeWorkspaceId: string, data: Record<string, unknown>) {
    await this.db
      .update(wapisnapWorkspaces)
      .set({
        numberStatus: 'error' as any,
        updatedAt: new Date(),
      })
      .where(eq(wapisnapWorkspaces.workspaceId, bridgeWorkspaceId))
  }

  // --- Private helpers ---

  private assertActive(ws: typeof wapisnapWorkspaces.$inferSelect) {
    if (!ws.isActive) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'WapiSnap workspace is paused. Resume before sending messages.',
      })
    }
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }
    return membership
  }
}
