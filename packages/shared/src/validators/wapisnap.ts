import { z } from 'zod'

// --- Shared constants ---

const wapisnapTemplateCategoryValues = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const
const wapisnapTemplateStatusValues = ['PENDING', 'APPROVED', 'REJECTED'] as const
const wapisnapSequenceStatusValues = ['active', 'paused', 'completed', 'cancelled'] as const
const wapisnapMessageStatusValues = ['queued', 'sent', 'delivered', 'read', 'failed'] as const

// --- Sequence step schema ---

export const sequenceStepSchema = z.object({
  action: z.enum(['send_template', 'send_text', 'send_interactive', 'wait']),
  templateName: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
  text: z.string().optional(),
  delayAfter: z.number().int().min(0).describe('Delay in minutes after this step'),
})

// --- Router input schemas ---

export const wapisnapProvisionSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
})

export const wapisnapGetStatusSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
})

export const wapisnapSendReviewRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
  phone: z.string().min(10).max(20),
  customerName: z.string().min(1).max(255),
  journeyLink: z.string().url(),
})

export const wapisnapSendCouponSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
  phone: z.string().min(10).max(20),
  customerName: z.string().min(1).max(255),
  couponCode: z.string().min(1).max(50),
  discount: z.string().min(1).max(50),
})

export const wapisnapListTemplatesSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
})

export const wapisnapSyncTemplatesSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
})

export const wapisnapCreateSequenceSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  phone: z.string().min(10).max(20),
  steps: z.array(sequenceStepSchema).min(1),
})

export const wapisnapCancelSequenceSchema = z.object({
  workspaceId: z.string().uuid(),
  sequenceId: z.string().uuid(),
})

export const wapisnapGetDeliveryStatsSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

export const wapisnapPauseSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
})

export const wapisnapResumeSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid(),
})

// --- Webhook payload schemas ---

export const wapisnapWebhookPayloadSchema = z.object({
  event: z.enum([
    'message_status',
    'message_received',
    'number_ready',
    'number_error',
    'broadcast_completed',
  ]),
  workspaceId: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().optional(),
})
