import { protectedProcedure, router } from '../trpc/middleware'
import {
  listEscalationRulesSchema,
  createEscalationRuleSchema,
  updateEscalationRuleSchema,
  deleteEscalationRuleSchema,
  listEscalationsSchema,
  getEscalationSchema,
  updateEscalationSchema,
  resolveEscalationSchema,
  getEscalationStatsSchema,
} from '@rectangled/shared'
import { z } from 'zod'
import { CxRoutingService } from './cx-routing.service'

export function createCxRoutingRouter(service: CxRoutingService) {
  return router({
    // ─── Rules ───────────────────────────────
    listRules: protectedProcedure
      .input(listEscalationRulesSchema)
      .query(async ({ input, ctx }) => {
        return service.listRules(input.workspaceId, ctx.user.sub)
      }),

    createRule: protectedProcedure
      .input(createEscalationRuleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.createRule(input, ctx.user.sub)
      }),

    updateRule: protectedProcedure
      .input(updateEscalationRuleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateRule(input, ctx.user.sub)
      }),

    deleteRule: protectedProcedure
      .input(deleteEscalationRuleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.deleteRule(input.workspaceId, input.ruleId, ctx.user.sub)
      }),

    // ─── Escalations ─────────────────────────
    listEscalations: protectedProcedure
      .input(listEscalationsSchema)
      .query(async ({ input, ctx }) => {
        return service.listEscalations(input, ctx.user.sub)
      }),

    getEscalation: protectedProcedure
      .input(getEscalationSchema)
      .query(async ({ input, ctx }) => {
        return service.getEscalation(input.workspaceId, input.escalationId, ctx.user.sub)
      }),

    updateEscalation: protectedProcedure
      .input(updateEscalationSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateEscalation(input, ctx.user.sub)
      }),

    resolveEscalation: protectedProcedure
      .input(resolveEscalationSchema)
      .mutation(async ({ input, ctx }) => {
        return service.resolveEscalation(input, ctx.user.sub)
      }),

    // ─── Notes ───────────────────────────────
    addNote: protectedProcedure
      .input(z.object({
        workspaceId: z.string().uuid(),
        escalationId: z.string().uuid(),
        text: z.string().min(1).max(2000),
      }))
      .mutation(async ({ input, ctx }) => {
        return service.addNote(input, ctx.user.sub, ctx.user.email ?? 'Unknown')
      }),

    // ─── Stats ───────────────────────────────
    getStats: protectedProcedure
      .input(getEscalationStatsSchema)
      .query(async ({ input, ctx }) => {
        return service.getStats(input, ctx.user.sub)
      }),

    // ─── Phase 0 Fix 5: SLA pause/resume ─────
    pauseEscalation: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          escalationId: z.string().uuid(),
          reason: z.string().max(255).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.pauseEscalation(input, ctx.user.sub, ctx.user.email ?? 'Unknown')
      }),

    resumeEscalation: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          escalationId: z.string().uuid(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.resumeEscalation(input, ctx.user.sub, ctx.user.email ?? 'Unknown')
      }),

    // ─── Phase 0 Fix 6: manual escalation ────
    escalateManual: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          reviewId: z.string().uuid().optional(),
          customerId: z.string().uuid().optional(),
          locationId: z.string().uuid().optional(),
          priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
          assignToUserId: z.string().uuid().optional(),
          slaMinutes: z.number().int().min(0).optional(),
          notes: z.string().max(2000).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.escalateManual(input, ctx.user.sub, ctx.user.email ?? 'Unknown')
      }),

    // ─── Phase 0 Fix 12: bulk operations ─────
    bulkAssign: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          ids: z.array(z.string().uuid()).max(100),
          assignedToUserId: z.string().uuid().nullable(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.bulkAssign(input, ctx.user.sub)
      }),

    bulkResolve: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          ids: z.array(z.string().uuid()).max(100),
          note: z.string().max(2000).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.bulkResolve(input, ctx.user.sub)
      }),

    bulkClose: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          ids: z.array(z.string().uuid()).max(100),
          note: z.string().max(2000).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.bulkClose(input, ctx.user.sub)
      }),

    bulkUpdatePriority: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          ids: z.array(z.string().uuid()).max(100),
          priority: z.enum(['low', 'medium', 'high', 'critical']),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return service.bulkUpdatePriority(input, ctx.user.sub)
      }),
  })
}
