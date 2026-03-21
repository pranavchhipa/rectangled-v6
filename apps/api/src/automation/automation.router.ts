import { protectedProcedure, router } from '../trpc/middleware'
import {
  listAutomationRulesSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  deleteAutomationRuleSchema,
  listAutomationQueueSchema,
  cancelAutomationQueuedSchema,
  getAutomationStatsSchema,
} from '@rectangled/shared'
import { AutomationService } from './automation.service'

export function createAutomationRouter(service: AutomationService) {
  return router({
    listRules: protectedProcedure
      .input(listAutomationRulesSchema)
      .query(async ({ input, ctx }) => {
        return service.listRules(input.workspaceId, ctx.user.sub, input.journeyId)
      }),

    createRule: protectedProcedure
      .input(createAutomationRuleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.createRule(input, ctx.user.sub)
      }),

    updateRule: protectedProcedure
      .input(updateAutomationRuleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateRule(input, ctx.user.sub)
      }),

    deleteRule: protectedProcedure
      .input(deleteAutomationRuleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.deleteRule(input.workspaceId, input.ruleId, ctx.user.sub)
      }),

    listQueue: protectedProcedure
      .input(listAutomationQueueSchema)
      .query(async ({ input, ctx }) => {
        return service.listQueue(input.workspaceId, ctx.user.sub, {
          status: input.status,
          page: input.page,
          limit: input.limit,
        })
      }),

    cancelQueued: protectedProcedure
      .input(cancelAutomationQueuedSchema)
      .mutation(async ({ input, ctx }) => {
        return service.cancelQueued(input.workspaceId, input.queueId, ctx.user.sub)
      }),

    getStats: protectedProcedure
      .input(getAutomationStatsSchema)
      .query(async ({ input, ctx }) => {
        return service.getStats(input.workspaceId, ctx.user.sub, input.dateFrom, input.dateTo)
      }),
  })
}
