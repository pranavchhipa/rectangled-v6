import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, sql, count, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import type { Database } from '@rectangled/db'
import { couponTemplates, couponInstances, members } from '@rectangled/db'

@Injectable()
export class CouponService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async listTemplates(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    return this.db.query.couponTemplates.findMany({
      where: eq(couponTemplates.workspaceId, workspaceId),
      orderBy: [desc(couponTemplates.createdAt)],
    })
  }

  async createTemplate(
    input: {
      workspaceId: string
      name: string
      codePrefix: string
      discountType: 'percentage' | 'flat' | 'freebie'
      discountValue: number
      description?: string
      termsAndConditions?: string
      maxRedemptions?: number
      validityDays?: number
      metadata?: Record<string, unknown>
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const [template] = await this.db
      .insert(couponTemplates)
      .values({
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        codePrefix: input.codePrefix.toUpperCase().trim(),
        discountType: input.discountType,
        discountValue: input.discountValue,
        description: input.description,
        termsAndConditions: input.termsAndConditions,
        maxRedemptions: input.maxRedemptions,
        validityDays: input.validityDays ?? 30,
        metadata: input.metadata ?? {},
      })
      .returning()

    return template
  }

  async updateTemplate(
    input: {
      workspaceId: string
      templateId: string
      name?: string
      codePrefix?: string
      discountType?: 'percentage' | 'flat' | 'freebie'
      discountValue?: number
      description?: string
      termsAndConditions?: string
      maxRedemptions?: number | null
      validityDays?: number
      isActive?: boolean
      metadata?: Record<string, unknown>
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.couponTemplates.findFirst({
      where: and(
        eq(couponTemplates.id, input.templateId),
        eq(couponTemplates.workspaceId, input.workspaceId)
      ),
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon template not found' })
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) setValues.name = input.name.trim()
    if (input.codePrefix !== undefined) setValues.codePrefix = input.codePrefix.toUpperCase().trim()
    if (input.discountType !== undefined) setValues.discountType = input.discountType
    if (input.discountValue !== undefined) setValues.discountValue = input.discountValue
    if (input.description !== undefined) setValues.description = input.description
    if (input.termsAndConditions !== undefined) setValues.termsAndConditions = input.termsAndConditions
    if (input.maxRedemptions !== undefined) setValues.maxRedemptions = input.maxRedemptions
    if (input.validityDays !== undefined) setValues.validityDays = input.validityDays
    if (input.isActive !== undefined) setValues.isActive = input.isActive
    if (input.metadata !== undefined) setValues.metadata = input.metadata

    const [updated] = await this.db
      .update(couponTemplates)
      .set(setValues)
      .where(eq(couponTemplates.id, input.templateId))
      .returning()

    return updated
  }

  async deleteTemplate(workspaceId: string, templateId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const existing = await this.db.query.couponTemplates.findFirst({
      where: and(
        eq(couponTemplates.id, templateId),
        eq(couponTemplates.workspaceId, workspaceId)
      ),
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon template not found' })
    }

    // Soft delete — set isActive to false
    const [updated] = await this.db
      .update(couponTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(couponTemplates.id, templateId))
      .returning()

    return updated
  }

  async issueCoupon(
    input: {
      workspaceId: string
      templateId: string
      customerId?: string
      locationId?: string
      journeyResponseId?: string
      reviewId?: string
      deliveryMethod: 'whatsapp' | 'email' | 'sms' | 'in_app' | 'manual'
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const template = await this.db.query.couponTemplates.findFirst({
      where: and(
        eq(couponTemplates.id, input.templateId),
        eq(couponTemplates.workspaceId, input.workspaceId)
      ),
    })
    if (!template || !template.isActive) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon template not found or inactive' })
    }

    // Check max redemptions
    if (template.maxRedemptions) {
      const [result] = await this.db
        .select({ total: count() })
        .from(couponInstances)
        .where(eq(couponInstances.templateId, template.id))
      if (result && result.total >= template.maxRedemptions) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum coupon issuance limit reached for this template' })
      }
    }

    const uniqueCode = `${template.codePrefix}-${randomUUID().slice(0, 6).toUpperCase()}`
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + template.validityDays)

    const [instance] = await this.db
      .insert(couponInstances)
      .values({
        templateId: template.id,
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        locationId: input.locationId,
        journeyResponseId: input.journeyResponseId,
        reviewId: input.reviewId,
        uniqueCode,
        status: 'issued',
        expiresAt,
        deliveryMethod: input.deliveryMethod,
        deliveryStatus: 'pending',
        metadata: {},
      })
      .returning()

    return instance
  }

  async bulkIssueCoupons(
    input: {
      workspaceId: string
      templateId: string
      customerIds: string[]
      deliveryMethod: 'whatsapp' | 'email' | 'sms' | 'in_app' | 'manual'
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const template = await this.db.query.couponTemplates.findFirst({
      where: and(
        eq(couponTemplates.id, input.templateId),
        eq(couponTemplates.workspaceId, input.workspaceId)
      ),
    })
    if (!template || !template.isActive) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon template not found or inactive' })
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + template.validityDays)

    const values = input.customerIds.map((customerId) => ({
      templateId: template.id,
      workspaceId: input.workspaceId,
      customerId,
      uniqueCode: `${template.codePrefix}-${randomUUID().slice(0, 6).toUpperCase()}`,
      status: 'issued' as const,
      expiresAt,
      deliveryMethod: input.deliveryMethod,
      deliveryStatus: 'pending' as const,
      metadata: {},
    }))

    const instances = await this.db
      .insert(couponInstances)
      .values(values)
      .returning()

    return instances
  }

  async redeemCoupon(workspaceId: string, couponCode: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const instance = await this.db.query.couponInstances.findFirst({
      where: and(
        eq(couponInstances.uniqueCode, couponCode),
        eq(couponInstances.workspaceId, workspaceId)
      ),
    })
    if (!instance) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon not found' })
    }
    if (instance.status === 'redeemed') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Coupon has already been redeemed' })
    }
    if (instance.status === 'cancelled') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Coupon has been cancelled' })
    }
    if (instance.status === 'expired' || new Date() > instance.expiresAt) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Coupon has expired' })
    }

    const [updated] = await this.db
      .update(couponInstances)
      .set({
        status: 'redeemed',
        redeemedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(couponInstances.id, instance.id))
      .returning()

    return updated
  }

  async listCoupons(
    input: {
      workspaceId: string
      status?: 'issued' | 'redeemed' | 'expired' | 'cancelled'
      customerId?: string
      templateId?: string
      page: number
      limit: number
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const conditions = [eq(couponInstances.workspaceId, input.workspaceId)]
    if (input.status) conditions.push(eq(couponInstances.status, input.status))
    if (input.customerId) conditions.push(eq(couponInstances.customerId, input.customerId))
    if (input.templateId) conditions.push(eq(couponInstances.templateId, input.templateId))

    const offset = (input.page - 1) * input.limit

    const [items, totalResult] = await Promise.all([
      this.db.query.couponInstances.findMany({
        where: and(...conditions),
        orderBy: [desc(couponInstances.createdAt)],
        limit: input.limit,
        offset,
        with: { template: true, customer: true },
      }),
      this.db
        .select({ total: count() })
        .from(couponInstances)
        .where(and(...conditions)),
    ])

    const total = totalResult[0]?.total ?? 0

    return {
      items,
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.ceil(total / input.limit),
    }
  }

  async getCouponStats(workspaceId: string, templateId: string | undefined, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const conditions = [eq(couponInstances.workspaceId, workspaceId)]
    if (templateId) conditions.push(eq(couponInstances.templateId, templateId))

    const [totalResult] = await this.db
      .select({ total: count() })
      .from(couponInstances)
      .where(and(...conditions))

    const [redeemedResult] = await this.db
      .select({ total: count() })
      .from(couponInstances)
      .where(and(...conditions, eq(couponInstances.status, 'redeemed')))

    const totalIssued = totalResult?.total ?? 0
    const totalRedeemed = redeemedResult?.total ?? 0
    const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0

    return {
      totalIssued,
      totalRedeemed,
      redemptionRate: Math.round(redemptionRate * 100) / 100,
    }
  }

  async verifyCoupon(code: string) {
    // Only look up by code — return minimal info to prevent enumeration
    const instance = await this.db.query.couponInstances.findFirst({
      where: eq(couponInstances.uniqueCode, code),
      with: { template: true },
    })

    if (!instance) {
      return { valid: false, reason: 'Invalid coupon' }
    }
    if (instance.status === 'redeemed') {
      return { valid: false, reason: 'Coupon is no longer valid' }
    }
    if (instance.status === 'cancelled') {
      return { valid: false, reason: 'Coupon is no longer valid' }
    }
    if (instance.status === 'expired' || new Date() > instance.expiresAt) {
      return { valid: false, reason: 'Coupon has expired' }
    }

    // Return only minimal info — no internal IDs, no template name
    return {
      valid: true,
      discountType: instance.template.discountType,
      discountValue: instance.template.discountValue,
      expiresAt: instance.expiresAt,
    }
  }

  async autoIssueCoupon(input: {
    workspaceId: string
    templateId: string
    customerId?: string
    locationId?: string
    journeyResponseId?: string
    reviewId?: string
    deliveryMethod: 'whatsapp' | 'email' | 'sms' | 'in_app' | 'manual'
  }) {
    const template = await this.db.query.couponTemplates.findFirst({
      where: and(
        eq(couponTemplates.id, input.templateId),
        eq(couponTemplates.workspaceId, input.workspaceId)
      ),
    })
    if (!template || !template.isActive) {
      return null
    }

    const uniqueCode = `${template.codePrefix}-${randomUUID().slice(0, 6).toUpperCase()}`
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + template.validityDays)

    const [instance] = await this.db
      .insert(couponInstances)
      .values({
        templateId: template.id,
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        locationId: input.locationId,
        journeyResponseId: input.journeyResponseId,
        reviewId: input.reviewId,
        uniqueCode,
        status: 'issued',
        expiresAt,
        deliveryMethod: input.deliveryMethod,
        deliveryStatus: 'pending',
        metadata: {},
      })
      .returning()

    return instance
  }

  async generateWithAi(
    input: { workspaceId: string; prompt: string },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'OptimizerV6 - Rectangled.io',
      },
    })

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a coupon creation assistant for an Indian SMB reputation management platform. Generate coupon details based on the user's description. Return a JSON object with these fields:
- name: string (coupon template name)
- codePrefix: string (3-5 char uppercase prefix for the coupon code, e.g. "WELCOME", "FLAT10")
- discountType: "percentage" | "flat" | "freebie"
- discountValue: number (percentage amount or flat INR amount; 0 for freebie)
- validityDays: number (how many days the coupon is valid)
- description: string (brief description of the offer)

Return ONLY valid JSON, no markdown.`,
        },
        { role: 'user', content: input.prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    const responseText = completion.choices[0]?.message?.content ?? '{}'
    try {
      return JSON.parse(responseText)
    } catch {
      return {
        name: 'Custom Offer',
        codePrefix: 'OFFER',
        discountType: 'percentage',
        discountValue: 10,
        validityDays: 30,
        description: responseText,
      }
    }
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
}
