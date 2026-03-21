import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  submitNevResponseSchema,
  getNevAnalyticsSchema,
  getNevTrendsSchema,
  getEmotionDefinitionsSchema,
  analyzeNevTextSchema,
} from '@rectangled/shared'
import { NevService } from './nev.service'

export function createNevRouter(service: NevService) {
  return router({
    seedEmotions: protectedProcedure.mutation(async () => {
      return service.seedEmotions()
    }),

    getEmotionDefinitions: publicProcedure
      .input(getEmotionDefinitionsSchema)
      .query(async () => {
        return service.getEmotionDefinitions()
      }),

    submitResponse: publicProcedure
      .input(submitNevResponseSchema)
      .mutation(async ({ input }) => {
        return service.submitResponse(input)
      }),

    getAnalytics: protectedProcedure
      .input(getNevAnalyticsSchema)
      .query(async ({ input, ctx }) => {
        return service.getAnalytics(input, ctx.user.sub)
      }),

    getTrends: protectedProcedure
      .input(getNevTrendsSchema)
      .query(async ({ input, ctx }) => {
        return service.getTrends(input, ctx.user.sub)
      }),

    analyzeText: protectedProcedure
      .input(analyzeNevTextSchema)
      .mutation(async ({ input, ctx }) => {
        return service.analyzeText(input, ctx.user.sub)
      }),
  })
}
