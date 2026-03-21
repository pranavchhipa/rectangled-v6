import { protectedProcedure, router } from '../trpc/middleware'
import {
  wapisnapProvisionSchema,
  wapisnapGetStatusSchema,
  wapisnapSendReviewRequestSchema,
  wapisnapSendCouponSchema,
  wapisnapListTemplatesSchema,
  wapisnapSyncTemplatesSchema,
  wapisnapCreateSequenceSchema,
  wapisnapCancelSequenceSchema,
  wapisnapGetDeliveryStatsSchema,
  wapisnapPauseSchema,
  wapisnapResumeSchema,
} from '@rectangled/shared'
import { WapisnapService } from './wapisnap.service'

export function createWapisnapRouter(service: WapisnapService) {
  return router({
    provision: protectedProcedure
      .input(wapisnapProvisionSchema)
      .mutation(async ({ input, ctx }) => {
        return service.provisionForLocation(input.locationId, ctx.user.sub)
      }),

    getStatus: protectedProcedure
      .input(wapisnapGetStatusSchema)
      .query(async ({ input, ctx }) => {
        return service.getWorkspaceForLocation(input.locationId)
      }),

    sendReviewRequest: protectedProcedure
      .input(wapisnapSendReviewRequestSchema)
      .mutation(async ({ input, ctx }) => {
        return service.sendReviewRequest(
          input.locationId,
          input.phone,
          input.customerName,
          input.journeyLink
        )
      }),

    sendCoupon: protectedProcedure
      .input(wapisnapSendCouponSchema)
      .mutation(async ({ input, ctx }) => {
        return service.sendCoupon(
          input.locationId,
          input.phone,
          input.customerName,
          input.couponCode,
          input.discount
        )
      }),

    listTemplates: protectedProcedure
      .input(wapisnapListTemplatesSchema)
      .query(async ({ input, ctx }) => {
        return service.listTemplates(input.locationId)
      }),

    syncTemplates: protectedProcedure
      .input(wapisnapSyncTemplatesSchema)
      .mutation(async ({ input, ctx }) => {
        return service.syncTemplates(input.locationId)
      }),

    createSequence: protectedProcedure
      .input(wapisnapCreateSequenceSchema)
      .mutation(async ({ input, ctx }) => {
        return service.createSequence(
          input.workspaceId,
          input.customerId,
          input.phone,
          input.steps
        )
      }),

    cancelSequence: protectedProcedure
      .input(wapisnapCancelSequenceSchema)
      .mutation(async ({ input, ctx }) => {
        return service.cancelSequence(input.sequenceId, ctx.user.sub)
      }),

    getDeliveryStats: protectedProcedure
      .input(wapisnapGetDeliveryStatsSchema)
      .query(async ({ input, ctx }) => {
        return service.getDeliveryStats(input.locationId, {
          from: input.dateFrom,
          to: input.dateTo,
        })
      }),

    pause: protectedProcedure
      .input(wapisnapPauseSchema)
      .mutation(async ({ input, ctx }) => {
        return service.pauseLocation(input.locationId, ctx.user.sub)
      }),

    resume: protectedProcedure
      .input(wapisnapResumeSchema)
      .mutation(async ({ input, ctx }) => {
        return service.resumeLocation(input.locationId, ctx.user.sub)
      }),
  })
}
