import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listJourneysSchema,
  getJourneyByIdSchema,
  createJourneySchema,
  updateJourneySchema,
  archiveJourneySchema,
  updateJourneyScreensSchema,
  getPublicJourneySchema,
  submitJourneyResponseSchema,
} from '@rectangled/shared'
import { z } from 'zod'
import { JourneyService } from './journey.service'

// Phase 2 Stage F — bulk operation validators (kept inline here for now;
// they're tightly coupled to the journey router).
const bulkDeployJourneySchema = z.object({
  sourceJourneyId: z.string().uuid(),
  targetLocationIds: z.array(z.string().uuid()).min(1).max(100),
  customizePerLocation: z
    .array(
      z.object({
        locationId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        settings: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
})

const getBulkSlugsSchema = z.object({
  journeyIds: z.array(z.string().uuid()).min(1).max(200),
})

export function createJourneyRouter(service: JourneyService) {
  return router({
    list: protectedProcedure.input(listJourneysSchema).query(async ({ input, ctx }) => {
      return service.list(input.workspaceId, input.locationId, ctx.user.sub, input.includeArchived)
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

    archive: protectedProcedure.input(archiveJourneySchema).mutation(async ({ input, ctx }) => {
      return service.archive(input.id, ctx.user.sub)
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

    // Phase 2 Stage F — bulk operations.
    bulkDeploy: protectedProcedure
      .input(bulkDeployJourneySchema)
      .mutation(async ({ input, ctx }) => {
        return service.bulkDeploy(input as any, ctx.user.sub)
      }),

    getBulkSlugs: protectedProcedure
      .input(getBulkSlugsSchema)
      .query(async ({ input, ctx }) => {
        return service.getBulkSlugs(input, ctx.user.sub)
      }),
  })
}
