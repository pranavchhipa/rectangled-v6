import { z } from 'zod'

// --- Escalation Rules ---

export const listEscalationRulesSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
})

export const createEscalationRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  triggerType: z.enum(['rating_threshold', 'aspect_match', 'keyword_match', 'sentiment', 'manual']),
  triggerConfig: z.record(z.unknown()).default({}),
  assignToUserId: z.string().uuid().optional(),
  assignToRole: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  slaMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

export const updateEscalationRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  ruleId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  triggerType: z.enum(['rating_threshold', 'aspect_match', 'keyword_match', 'sentiment', 'manual']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  assignToUserId: z.string().uuid().nullable().optional(),
  assignToRole: z.string().max(50).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  slaMinutes: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const deleteEscalationRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  ruleId: z.string().uuid(),
})

// --- Escalations ---

export const listEscalationsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'expired']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedToUserId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export const getEscalationSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  escalationId: z.string().uuid(),
})

export const updateEscalationSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  escalationId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'expired']).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
})

export const resolveEscalationSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  escalationId: z.string().uuid(),
  notes: z.string().optional(),
})

export const getEscalationStatsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})
