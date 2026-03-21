import { protectedProcedure, router } from '../trpc/middleware'
import { z } from 'zod'
import {
  publishGbpPostSchema,
  listGbpPostsSchema,
  deleteGbpPostSchema,
} from '@rectangled/shared'
import { ListingService } from './listing.service'

export function createListingRouter(service: ListingService) {
  return router({
    list: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return service.list(input.workspaceId, ctx.user.sub)
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return service.getById(input.id, ctx.user.sub)
      }),

    getChanges: protectedProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return service.getChanges(input.listingId, ctx.user.sub)
      }),

    resolveChange: protectedProcedure
      .input(z.object({ changeId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return service.resolveChange(input.changeId, ctx.user.sub)
      }),

    createPost: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          locationId: z.string().uuid(),
          type: z.string(),
          title: z.string().optional(),
          content: z.string(),
          imageUrl: z.string().optional(),
          ctaType: z.string().optional(),
          ctaUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return service.createPost(input, ctx.user.sub)
      }),

    listPosts: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), locationId: z.string().uuid().optional() }))
      .query(async ({ input, ctx }) => {
        return service.listPosts(input.workspaceId, input.locationId, ctx.user.sub)
      }),

    sync: protectedProcedure
      .input(z.object({ connectorInstanceId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return service.syncListing(input.connectorInstanceId, ctx.user.sub)
      }),

    publishGbpPost: protectedProcedure
      .input(publishGbpPostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.publishGbpPost(input, ctx.user.sub)
      }),

    listGbpPosts: protectedProcedure
      .input(listGbpPostsSchema)
      .query(async ({ input, ctx }) => {
        return service.syncGbpPosts(
          input.workspaceId,
          input.locationId,
          ctx.user.sub
        )
      }),

    deleteGbpPost: protectedProcedure
      .input(deleteGbpPostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.deleteGbpPost(
          input.workspaceId,
          input.locationId,
          input.postId,
          ctx.user.sub
        )
      }),
  })
}
