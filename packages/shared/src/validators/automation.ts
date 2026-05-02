import { z } from 'zod'

const automationTriggerEvents = [
  'journey_completed_positive',
  'journey_completed_negative',
  'journey_abandoned',
  'review_posted',
  'review_posted_google',
  'customer_dormant',
  'custom',
] as const

const automationActionTypes = [
  'send_coupon',
  'send_message',
  'create_escalation',
  'tag_customer',
  'trigger_journey',
  'ai_reply_review',
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
  // Phase 5 — automation_rules.journey_id was dropped. The field is
  // accepted for back-compat but the server ignores it.
  journeyId: z.string().uuid().optional(),
})

// Phase 2 — rule scope. Default 'workspace' preserves existing behaviour.
const ruleScopes = ['organization', 'workspace', 'location'] as const
export const ruleScopeSchema = z.enum(ruleScopes)

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
  // Phase 0 Fix 4 — per-customer cooldown in hours. null = no cooldown.
  cooldownHours: z.number().int().min(0).max(8760).nullable().optional(),
  // Phase 2 — rule inheritance. The engine resolves precedence as
  // location > workspace > organization, so a 'location' rule overrides
  // the workspace one for matching contexts. organizationId is required
  // when scope='organization'; locationId is required when scope='location'.
  scope: ruleScopeSchema.optional(),
  organizationId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  overridesRuleId: z.string().uuid().nullable().optional(),
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
  cooldownHours: z.number().int().min(0).max(8760).nullable().optional(),
  scope: ruleScopeSchema.optional(),
  organizationId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  overridesRuleId: z.string().uuid().nullable().optional(),
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
