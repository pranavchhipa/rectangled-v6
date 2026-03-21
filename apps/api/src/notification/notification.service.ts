import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, sql, lte, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { notifications, members } from '@rectangled/db'

type NotificationType =
  | 'review_received'
  | 'escalation_created'
  | 'escalation_assigned'
  | 'sla_breach'
  | 'coupon_redeemed'
  | 'sync_complete'
  | 'sync_failed'
  | 'team_invite'
  | 'journey_response'
  | 'system'

@Injectable()
export class NotificationService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // ─── Create ────────────────────────────────────────────

  async create(
    workspaceId: string,
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    metadata?: Record<string, unknown>,
  ) {
    const [notification] = await this.db
      .insert(notifications)
      .values({
        workspaceId,
        userId,
        type,
        title,
        message,
        link: link ?? null,
        metadata: metadata ?? {},
      })
      .returning()

    return notification
  }

  // ─── List ──────────────────────────────────────────────

  async list(
    input: {
      workspaceId: string
      isRead?: boolean
      page?: number
      limit?: number
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const page = input.page ?? 1
    const limit = Math.min(input.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const conditions = [
      eq(notifications.workspaceId, input.workspaceId),
      eq(notifications.userId, userId),
    ]
    if (input.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, input.isRead))
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(where),
    ])

    const total = countResult[0]?.count ?? 0

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  // ─── Mark Read ─────────────────────────────────────────

  async markRead(workspaceId: string, notificationId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const existing = await this.db.query.notifications.findFirst({
      where: and(
        eq(notifications.id, notificationId),
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId),
      ),
    })

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' })
    }

    const [updated] = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning()

    return updated
  }

  // ─── Mark All Read ─────────────────────────────────────

  async markAllRead(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.workspaceId, workspaceId),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      )

    return { success: true }
  }

  // ─── Unread Count ──────────────────────────────────────

  async getUnreadCount(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, workspaceId),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      )

    return { unreadCount: result?.count ?? 0 }
  }

  // ─── Notification Helpers ──────────────────────────────

  async notifyNewReview(
    workspaceId: string,
    review: { id: string; reviewerName: string | null; rating: number; platform: string },
  ) {
    const workspaceMembers = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.workspaceId, workspaceId),
          isNotNull(members.acceptedAt),
        ),
      )

    const title = `New ${review.rating}-star review`
    const message = `${review.reviewerName ?? 'Anonymous'} left a ${review.rating}-star review on ${review.platform}.`

    for (const member of workspaceMembers) {
      await this.create(
        workspaceId,
        member.userId,
        'review_received',
        title,
        message,
        `/reviews/${review.id}`,
        { reviewId: review.id },
      )
    }
  }

  async notifyEscalation(
    workspaceId: string,
    escalation: { id: string; assignedToUserId: string | null; priority: string },
  ) {
    if (!escalation.assignedToUserId) return

    await this.create(
      workspaceId,
      escalation.assignedToUserId,
      'escalation_assigned',
      `Escalation assigned to you (${escalation.priority})`,
      `A new ${escalation.priority}-priority escalation has been assigned to you.`,
      `/escalations/${escalation.id}`,
      { escalationId: escalation.id },
    )
  }

  async notifySlaBreach(
    workspaceId: string,
    escalation: { id: string; assignedToUserId: string | null },
  ) {
    // Notify managers
    const managerMembers = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.workspaceId, workspaceId),
          sql`${members.role} IN ('owner', 'manager')`,
          isNotNull(members.acceptedAt),
        ),
      )

    for (const member of managerMembers) {
      await this.create(
        workspaceId,
        member.userId,
        'sla_breach',
        'SLA Breached',
        'An escalation has exceeded its SLA deadline.',
        `/escalations/${escalation.id}`,
        { escalationId: escalation.id },
      )
    }
  }

  async notifyCouponRedeemed(
    workspaceId: string,
    coupon: { id: string; code: string; customerName?: string },
  ) {
    const staffMembers = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.workspaceId, workspaceId),
          isNotNull(members.acceptedAt),
        ),
      )

    for (const member of staffMembers) {
      await this.create(
        workspaceId,
        member.userId,
        'coupon_redeemed',
        'Coupon Redeemed',
        `${coupon.customerName ?? 'A customer'} redeemed coupon ${coupon.code}.`,
        undefined,
        { couponId: coupon.id },
      )
    }
  }

  // ─── Cleanup ───────────────────────────────────────────

  async deleteOld() {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const deleted = await this.db
      .delete(notifications)
      .where(lte(notifications.createdAt, cutoff))
      .returning()

    return { deletedCount: deleted.length }
  }

  // ─── Helpers ───────────────────────────────────────────

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
