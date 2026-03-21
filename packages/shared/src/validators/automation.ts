import { z } from 'zod'

const automationTriggerEvents = [
  'journey_completed_positive',
  'journey_completed_negative',
  'journey_abandoned',
  'review_posted',
  'customer_dormant',
  'custom',
] as const

const automationActionTypes = [
  'send_coupon',
  'send_message',
  'create_escalation',
  'tag_customer',
  'trigger_journey',
] as const

const automationQueueStatuses = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const

export const listAutomationRulesSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  journeyId: z.string().uuid().optional(),
})

export const createAutomationRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  journeyId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  triggerEvent: z.enum(automationTriggerEvents),
  delayMinutes: z.number().int().min(0),
  actionType: z.enum(automationActionTypes),
  actionConfig: z.record(z.unknown()).default({}),
  conditions: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

export const updateAutomationRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  ruleId: z.string().uuid(),
  journeyId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  triggerEvent: z.enum(automationTriggerEvents).optional(),
  delayMinutes: z.number().int().min(0).optional(),
  actionType: z.enum(automationActionTypes).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  conditions: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

export const deleteAutomationRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  ruleId: z.string().uuid(),
})

export const listAutomationQueueSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  status: z.enum(automationQueueStatuses).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
})

export const cancelAutomationQueuedSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  queueId: z.string().uuid(),
})

export const getAutomationStatsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

export const triggerAutomationSchema = z.object({
  workspaceId: z.string().uuid(),
  event: z.enum(automationTriggerEvents),
  journeyId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  journeyResponseId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
})
