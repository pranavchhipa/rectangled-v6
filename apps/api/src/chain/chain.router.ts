import { protectedProcedure, router } from '../trpc/middleware'
import {
  chainOverviewSchema,
  chainLeaderboardSchema,
  chainRatingTrendsSchema,
  chainGeoDistributionSchema,
  chainResponseTimeHeatmapSchema,
  chainEscalationLoadSchema,
} from '@rectangled/shared'
import { ChainService } from './chain.service'

export function createChainRouter(service: ChainService) {
  return router({
    getOverviewKpis: protectedProcedure
      .input(chainOverviewSchema)
      .query(async ({ input, ctx }) => {
        return service.getOverviewKpis(input, ctx.user.sub)
      }),

    getLocationLeaderboard: protectedProcedure
      .input(chainLeaderboardSchema)
      .query(async ({ input, ctx }) => {
        return service.getLocationLeaderboard(input, ctx.user.sub)
      }),

    getRatingTrendsByLocation: protectedProcedure
      .input(chainRatingTrendsSchema)
      .query(async ({ input, ctx }) => {
        return service.getRatingTrendsByLocation(input, ctx.user.sub)
      }),

    getGeoDistribution: protectedProcedure
      .input(chainGeoDistributionSchema)
      .query(async ({ input, ctx }) => {
        return service.getGeoDistribution(input, ctx.user.sub)
      }),

    getResponseTimeHeatmap: protectedProcedure
      .input(chainResponseTimeHeatmapSchema)
      .query(async ({ input, ctx }) => {
        return service.getResponseTimeHeatmap(input, ctx.user.sub)
      }),

    getEscalationLoad: protectedProcedure
      .input(chainEscalationLoadSchema)
      .query(async ({ input, ctx }) => {
        return service.getEscalationLoad(input, ctx.user.sub)
      }),
  })
}
