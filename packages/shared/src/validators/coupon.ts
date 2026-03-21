import { z } from 'zod'

export const listCouponTemplatesSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const createCouponTemplateSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  codePrefix: z.string().min(1).max(20),
  discountType: z.enum(['percentage', 'flat', 'freebie']),
  discountValue: z.number().min(0),
  description: z.string().optional(),
  termsAndConditions: z.string().optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  validityDays: z.number().int().min(1).default(30),
  metadata: z.record(z.unknown()).optional(),
})

export const updateCouponTemplateSchema = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  codePrefix: z.string().min(1).max(20).optional(),
  discountType: z.enum(['percentage', 'flat', 'freebie']).optional(),
  discountValue: z.number().min(0).optional(),
  description: z.string().optional(),
  termsAndConditions: z.string().optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  validityDays: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const deleteCouponTemplateSchema = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid(),
})

export const issueCouponSchema = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  journeyResponseId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  deliveryMethod: z.enum(['whatsapp', 'email', 'sms', 'in_app', 'manual']),
})

export const bulkIssueCouponsSchema = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).min(1),
  deliveryMethod: z.enum(['whatsapp', 'email', 'sms', 'in_app', 'manual']),
})

export const redeemCouponSchema = z.object({
  workspaceId: z.string().uuid(),
  couponCode: z.string().min(1),
})

export const listCouponsSchema = z.object({
  workspaceId: z.string().uuid(),
  status: z.enum(['issued', 'redeemed', 'expired', 'cancelled']).optional(),
  customerId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export const getCouponStatsSchema = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
})

export const verifyCouponSchema = z.object({
  code: z.string().min(1),
})

export const generateCouponWithAiSchema = z.object({
  workspaceId: z.string().uuid(),
  prompt: z.string().min(5).max(500),
})
