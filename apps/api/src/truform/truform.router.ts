import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listTruformsSchema,
  getTruformByIdSchema,
  createTruformSchema,
  updateTruformSchema,
  deleteTruformSchema,
  activateTruformSchema,
  archiveTruformSchema,
  getPublicTruformSchema,
  submitTruformResponseSchema,
  listTruformResponsesSchema,
  getTruformStatsSchema,
} from '@rectangled/shared'
import { TruformService } from './truform.service'

export function createTruformRouter(service: TruformService) {
  return router({
    list: protectedProcedure.input(listTruformsSchema).query(async ({ input, ctx }) => {
      return service.list(input.workspaceId, input.locationId, ctx.user.sub)
    }),

    getById: protectedProcedure.input(getTruformByIdSchema).query(async ({ input, ctx }) => {
      return service.getById(input.id, ctx.user.sub)
    }),

    create: protectedProcedure.input(createTruformSchema).mutation(async ({ input, ctx }) => {
      return service.create(input, ctx.user.sub)
    }),

    update: protectedProcedure.input(updateTruformSchema).mutation(async ({ input, ctx }) => {
      return service.update(input, ctx.user.sub)
    }),

    delete: protectedProcedure.input(deleteTruformSchema).mutation(async ({ input, ctx }) => {
      return service.delete(input.id, ctx.user.sub)
    }),

    activate: protectedProcedure.input(activateTruformSchema).mutation(async ({ input, ctx }) => {
      return service.activate(input.id, ctx.user.sub)
    }),

    archive: protectedProcedure.input(archiveTruformSchema).mutation(async ({ input, ctx }) => {
      return service.archive(input.id, ctx.user.sub)
    }),

    // Public endpoints
    getPublic: publicProcedure.input(getPublicTruformSchema).query(async ({ input }) => {
      return service.getPublic(input.slug)
    }),

    submitResponse: publicProcedure
      .input(submitTruformResponseSchema)
      .mutation(async ({ input }) => {
        return service.submitResponse(input)
      }),

    // Protected response management
    getResponses: protectedProcedure
      .input(listTruformResponsesSchema)
      .query(async ({ input, ctx }) => {
        return service.getResponses(input.truformId, input.page, input.limit, ctx.user.sub)
      }),

    getStats: protectedProcedure.input(getTruformStatsSchema).query(async ({ input, ctx }) => {
      return service.getStats(input.truformId, ctx.user.sub)
    }),
  })
}
