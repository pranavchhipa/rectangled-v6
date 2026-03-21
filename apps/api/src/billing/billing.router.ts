import { protectedProcedure, router } from '../trpc/middleware'
import {
  getCurrentPlanSchema,
  listInvoicesSchema,
  createCheckoutSessionSchema,
  cancelSubscriptionSchema,
  handleWebhookSchema,
} from '@rectangled/shared'
import { BillingService } from './billing.service'

export function createBillingRouter(billingService: BillingService) {
  return router({
    getCurrentPlan: protectedProcedure
      .input(getCurrentPlanSchema)
      .query(async ({ input, ctx }) => {
        return billingService.getCurrentPlan(input.workspaceId, ctx.user.sub)
      }),

    listInvoices: protectedProcedure
      .input(listInvoicesSchema)
      .query(async ({ input, ctx }) => {
        return billingService.listInvoices(
          input.workspaceId,
          ctx.user.sub,
          input.page,
          input.limit,
        )
      }),

    createCheckoutSession: protectedProcedure
      .input(createCheckoutSessionSchema)
      .mutation(async ({ input, ctx }) => {
        return billingService.createCheckoutSession(
          input.workspaceId,
          input.plan,
          ctx.user.sub,
        )
      }),

    cancelSubscription: protectedProcedure
      .input(cancelSubscriptionSchema)
      .mutation(async ({ input, ctx }) => {
        return billingService.cancelSubscription(input.workspaceId, ctx.user.sub)
      }),

    handleWebhook: protectedProcedure
      .input(handleWebhookSchema)
      .mutation(async ({ input }) => {
        return billingService.handleWebhook({
          event: input.event,
          payload: input.payload,
        })
      }),
  })
}
