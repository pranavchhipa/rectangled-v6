import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { randomUUID } from 'crypto'
import { createHmac } from 'crypto'
import { eq, and, desc, sql } from 'drizzle-orm'
import Razorpay from 'razorpay'
import type { Database } from '@rectangled/db'
import { subscriptions, invoices, members } from '@rectangled/db'

let _razorpay: Razorpay | null = null
function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const key_id = process.env.RAZORPAY_KEY_ID
    if (!key_id) throw new Error('RAZORPAY_KEY_ID not configured')
    _razorpay = new Razorpay({
      key_id,
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    })
  }
  return _razorpay
}

const PLAN_PRICING = {
  pro: { amount: 299900, name: 'Pro Plan', period: 'monthly', interval: 1 }, // ₹2,999
  enterprise: { amount: 999900, name: 'Enterprise Plan', period: 'monthly', interval: 1 }, // ₹9,999
} as const

/** Plan feature limits by plan name */
const PLAN_LIMITS = {
  free: {
    locations: 1,
    reviewsPerMonth: 50,
    members: 2,
    aiResponses: 10,
    surveys: 1,
  },
  pro: {
    locations: 10,
    reviewsPerMonth: 5000,
    members: 10,
    aiResponses: 500,
    surveys: 20,
  },
  enterprise: {
    locations: -1, // unlimited
    reviewsPerMonth: -1,
    members: -1,
    aiResponses: -1,
    surveys: -1,
  },
} as const

export type PlanName = keyof typeof PLAN_LIMITS

@Injectable()
export class BillingService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /** Get the current plan for a workspace (returns free defaults if no subscription exists) */
  async getCurrentPlan(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.workspaceId, workspaceId),
    })

    if (!subscription) {
      return {
        plan: 'free' as PlanName,
        status: 'active',
        limits: PLAN_LIMITS.free,
        subscription: null,
      }
    }

    const plan = (subscription.plan as PlanName) || 'free'
    return {
      plan,
      status: subscription.status,
      limits: PLAN_LIMITS[plan] ?? PLAN_LIMITS.free,
      subscription: {
        id: subscription.id,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
      },
    }
  }

  /** List invoices for a workspace with pagination */
  async listInvoices(workspaceId: string, userId: string, page: number, limit: number) {
    await this.requireMembership(workspaceId, userId)

    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.workspaceId, workspaceId),
    })

    if (!subscription) {
      return { invoices: [], total: 0, page, limit }
    }

    const offset = (page - 1) * limit

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(invoices)
        .where(eq(invoices.subscriptionId, subscription.id))
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(eq(invoices.subscriptionId, subscription.id)),
    ])

    return {
      invoices: items,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    }
  }

  /** Create a Razorpay subscription checkout */
  async createCheckoutSession(workspaceId: string, plan: 'pro' | 'enterprise', userId: string) {
    const logger = new Logger('Billing')
    await this.requireMembership(workspaceId, userId)

    const existing = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, 'active'),
      ),
    })

    if (existing && existing.plan !== 'free') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace already has an active paid subscription. Cancel it first to switch plans.',
      })
    }

    const pricing = PLAN_PRICING[plan]

    try {
      // Create a Razorpay subscription
      const rzpSubscription = await getRazorpay().subscriptions.create({
        plan_id: '', // Will need actual plan IDs from Razorpay dashboard
        total_count: 12,
        quantity: 1,
        notes: {
          workspaceId,
          plan,
          userId,
        },
      } as any)

      // Save pending subscription
      const id = randomUUID()
      await this.db.insert(subscriptions).values({
        id,
        workspaceId,
        plan,
        status: 'pending',
        razorpaySubscriptionId: (rzpSubscription as any).id,
        metadata: { rzpSubscription },
      } as any)

      return {
        subscriptionId: (rzpSubscription as any).id,
        checkoutUrl: (rzpSubscription as any).short_url || '',
        plan,
        amount: pricing.amount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
      }
    } catch (err: any) {
      logger.warn(`Razorpay subscription creation failed: ${err.message}. Returning client-side checkout data.`)

      // Fallback: return data for client-side Razorpay checkout
      const orderId = `order_${Date.now()}`
      return {
        subscriptionId: null,
        checkoutUrl: null,
        plan,
        amount: pricing.amount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        clientCheckout: true,
        orderData: {
          name: 'Rectangled.io',
          description: pricing.name,
          amount: pricing.amount,
          currency: 'INR',
          notes: { workspaceId, plan },
        },
      }
    }
  }

  /** Cancel an active subscription */
  async cancelSubscription(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const subscription = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, 'active'),
      ),
    })

    if (!subscription || subscription.plan === 'free') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No active paid subscription to cancel',
      })
    }

    // Cancel on Razorpay
    if (subscription.razorpaySubscriptionId) {
      try {
        await getRazorpay().subscriptions.cancel(subscription.razorpaySubscriptionId)
      } catch (err: any) {
        new Logger('Billing').warn(`Razorpay cancel failed: ${err.message}`)
      }
    }

    const [updated] = await this.db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning()

    return { success: true, subscription: updated }
  }

  /** Verify Razorpay webhook signature */
  verifyWebhookSignature(body: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) return true // skip verification if no secret configured
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    return expected === signature
  }

  /** Process a Razorpay webhook event */
  async handleWebhook(payload: { event: string; payload: Record<string, unknown> }) {
    const logger = new Logger('Billing')
    const { event } = payload

    logger.log(`Razorpay webhook: ${event}`)

    switch (event) {
      case 'subscription.activated': {
        const sub = (payload.payload as any)?.subscription?.entity
        if (sub?.id) {
          const existing = await this.db.query.subscriptions.findFirst({
            where: eq(subscriptions.razorpaySubscriptionId, sub.id),
          })
          if (existing) {
            await this.db.update(subscriptions).set({
              status: 'active',
              currentPeriodStart: new Date(sub.current_start * 1000),
              currentPeriodEnd: new Date(sub.current_end * 1000),
              razorpayCustomerId: sub.customer_id || null,
              updatedAt: new Date(),
            }).where(eq(subscriptions.id, existing.id))
          }
        }
        break
      }
      case 'subscription.charged': {
        const payment = (payload.payload as any)?.payment?.entity
        const sub = (payload.payload as any)?.subscription?.entity
        if (payment && sub) {
          const existing = await this.db.query.subscriptions.findFirst({
            where: eq(subscriptions.razorpaySubscriptionId, sub.id),
          })
          if (existing) {
            await this.db.insert(invoices).values({
              id: randomUUID(),
              subscriptionId: existing.id,
              razorpayInvoiceId: payment.invoice_id || payment.id,
              amount: payment.amount,
              currency: payment.currency || 'INR',
              status: 'paid',
              paidAt: new Date(),
              invoiceUrl: payment.invoice_id ? `https://dashboard.razorpay.com/invoices/${payment.invoice_id}` : null,
            } as any)
            // Update period
            await this.db.update(subscriptions).set({
              currentPeriodStart: new Date(sub.current_start * 1000),
              currentPeriodEnd: new Date(sub.current_end * 1000),
              updatedAt: new Date(),
            }).where(eq(subscriptions.id, existing.id))
          }
        }
        break
      }
      case 'subscription.cancelled': {
        const sub = (payload.payload as any)?.subscription?.entity
        if (sub?.id) {
          await this.db.update(subscriptions).set({
            status: 'cancelled',
            updatedAt: new Date(),
          }).where(eq(subscriptions.razorpaySubscriptionId, sub.id))
        }
        break
      }
      case 'payment.failed': {
        const payment = (payload.payload as any)?.payment?.entity
        logger.warn(`Payment failed: ${payment?.id} - ${payment?.error_description}`)
        break
      }
      default:
        logger.log(`Unhandled webhook event: ${event}`)
        break
    }

    return { received: true, event }
  }

  /** Get plan feature limits */
  getPlanLimits(plan: PlanName) {
    return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace' })
    }
    return membership
  }
}
