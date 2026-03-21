import { protectedProcedure, router } from '../trpc/middleware'
import { createWorkspaceSchema, updateWorkspaceSchema } from '@rectangled/shared'
import { z } from 'zod'
import { WorkspaceService } from './workspace.service'

export function createWorkspaceRouter(workspaceService: WorkspaceService) {
  return router({
    create: protectedProcedure.input(createWorkspaceSchema).mutation(async ({ input, ctx }) => {
      return workspaceService.create(input, ctx.user.sub)
    }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return workspaceService.list(ctx.user.sub)
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return workspaceService.getById(input.id, ctx.user.sub)
      }),

    update: protectedProcedure.input(updateWorkspaceSchema).mutation(async ({ input, ctx }) => {
      return workspaceService.update(input, ctx.user.sub)
    }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return workspaceService.delete(input.id, ctx.user.sub)
      }),

    globalSearch: protectedProcedure
      .input(z.object({
        workspaceId: z.string().uuid(),
        query: z.string().min(2).max(200),
      }))
      .query(async ({ input, ctx }) => {
        return workspaceService.globalSearch(input.workspaceId, input.query, ctx.user.sub)
      }),
  })
}
