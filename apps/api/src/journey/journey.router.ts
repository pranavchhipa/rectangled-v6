import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listJourneysSchema,
  getJourneyByIdSchema,
  createJourneySchema,
  updateJourneySchema,
  deleteJourneySchema,
  updateJourneyScreensSchema,
  getPublicJourneySchema,
  submitJourneyResponseSchema,
} from '@rectangled/shared'
import { JourneyService } from './journey.service'

export function createJourneyRouter(service: JourneyService) {
  return router({
    list: protectedProcedure.input(listJourneysSchema).query(async ({ input, ctx }) => {
      return service.list(input.workspaceId, input.locationId, ctx.user.sub)
    }),

    getById: protectedProcedure.input(getJourneyByIdSchema).query(async ({ input, ctx }) => {
      return service.getById(input.id, ctx.user.sub)
    }),

    create: protectedProcedure.input(createJourneySchema).mutation(async ({ input, ctx }) => {
      return service.create(input, ctx.user.sub)
    }),

    update: protectedProcedure.input(updateJourneySchema).mutation(async ({ input, ctx }) => {
      return service.update(input, ctx.user.sub)
    }),

    delete: protectedProcedure.input(deleteJourneySchema).mutation(async ({ input, ctx }) => {
      return service.delete(input.id, ctx.user.sub)
    }),

    updateScreens: protectedProcedure
      .input(updateJourneyScreensSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateScreens(input.journeyId, input.screens, ctx.user.sub)
      }),

    // Public endpoints (no auth)
    getPublic: publicProcedure.input(getPublicJourneySchema).query(async ({ input }) => {
      return service.getPublicJourney(input.slug)
    }),

    submitResponse: publicProcedure
      .input(submitJourneyResponseSchema)
      .mutation(async ({ input }) => {
        return service.submitResponse(input)
      }),
  })
}
