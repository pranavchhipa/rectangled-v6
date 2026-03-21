import { protectedProcedure, router } from '../trpc/middleware'
import {
  listBusinessAspectsSchema,
  seedBusinessAspectsSchema,
  createBusinessAspectSchema,
  updateBusinessAspectSchema,
  deleteBusinessAspectSchema,
  reorderBusinessAspectsSchema,
} from '@rectangled/shared'
import { BusinessAspectService } from './business-aspect.service'

export function createBusinessAspectRouter(service: BusinessAspectService) {
  return router({
    list: protectedProcedure.input(listBusinessAspectsSchema).query(async ({ input, ctx }) => {
      return service.list(input.workspaceId, ctx.user.sub)
    }),

    seedDefaults: protectedProcedure
      .input(seedBusinessAspectsSchema)
      .mutation(async ({ input, ctx }) => {
        return service.seedDefaults(input.workspaceId, input.industry, ctx.user.sub)
      }),

    create: protectedProcedure.input(createBusinessAspectSchema).mutation(async ({ input, ctx }) => {
      return service.create(input, ctx.user.sub)
    }),

    update: protectedProcedure.input(updateBusinessAspectSchema).mutation(async ({ input, ctx }) => {
      return service.update(input, ctx.user.sub)
    }),

    delete: protectedProcedure.input(deleteBusinessAspectSchema).mutation(async ({ input, ctx }) => {
      return service.delete(input.id, ctx.user.sub)
    }),

    reorder: protectedProcedure
      .input(reorderBusinessAspectsSchema)
      .mutation(async ({ input, ctx }) => {
        return service.reorder(input.workspaceId, input.orderedIds, ctx.user.sub)
      }),
  })
}
