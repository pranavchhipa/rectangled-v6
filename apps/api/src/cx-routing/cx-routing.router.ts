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
  })
}
