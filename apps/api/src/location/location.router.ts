import { protectedProcedure, router } from '../trpc/middleware'
import { createLocationSchema, updateLocationSchema } from '@rectangled/shared'
import { z } from 'zod'
import { LocationService } from './location.service'

export function createLocationRouter(locationService: LocationService) {
  return router({
    create: protectedProcedure.input(createLocationSchema).mutation(async ({ input, ctx }) => {
      return locationService.create(input, ctx.user.sub)
    }),

    list: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return locationService.list(input.workspaceId, ctx.user.sub)
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return locationService.getById(input.id, ctx.user.sub)
      }),

    update: protectedProcedure.input(updateLocationSchema).mutation(async ({ input, ctx }) => {
      return locationService.update(input, ctx.user.sub)
    }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return locationService.delete(input.id, ctx.user.sub)
      }),

    toggleActive: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return locationService.toggleActive(input.id, ctx.user.sub)
      }),
  })
}
