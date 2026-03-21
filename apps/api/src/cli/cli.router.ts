import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  submitCliResponseSchema,
  getCliAnalyticsSchema,
  getCliTrendsSchema,
  getCliSegmentsSchema,
  getCustomerCliSchema,
} from '@rectangled/shared'
import { CliService } from './cli.service'

export function createCliRouter(service: CliService) {
  return router({
    submitResponse: publicProcedure
      .input(submitCliResponseSchema)
      .mutation(async ({ input }) => {
        return service.submitResponse(input)
      }),

    getAnalytics: protectedProcedure
      .input(getCliAnalyticsSchema)
      .query(async ({ input, ctx }) => {
        return service.getAnalytics(input, ctx.user.sub)
      }),

    getTrends: protectedProcedure
      .input(getCliTrendsSchema)
      .query(async ({ input, ctx }) => {
        return service.getTrends(input, ctx.user.sub)
      }),

    getSegments: protectedProcedure
      .input(getCliSegmentsSchema)
      .query(async ({ input, ctx }) => {
        return service.getSegments(input, ctx.user.sub)
      }),

    getCustomerCli: protectedProcedure
      .input(getCustomerCliSchema)
      .query(async ({ input, ctx }) => {
        return service.getCustomerCli(input, ctx.user.sub)
      }),
  })
}
