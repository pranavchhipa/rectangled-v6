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

    // ─── Phase 2 Stage F: bulk operations + SLA targets ──────────

    bulkUpdate: protectedProcedure
      .input(
        z.object({
          ids: z.array(z.string().uuid()).min(1).max(100),
          patch: z
            .object({
              name: z.string().min(1).max(255).optional(),
              address: z.string().optional(),
              city: z.string().max(100).optional(),
              state: z.string().max(100).optional(),
              country: z.string().max(100).optional(),
              phone: z.string().max(50).optional(),
              email: z.string().email().optional(),
              timezone: z.string().max(50).optional(),
              ownerName: z.string().max(255).optional(),
              isActive: z.boolean().optional(),
            })
            .strict(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return locationService.bulkUpdate(input as any, ctx.user.sub)
      }),

    setSlaTarget: protectedProcedure
      .input(
        z.object({
          locationId: z.string().uuid(),
          reviewResponseSlaMinutes: z.number().int().min(0).nullable().optional(),
          escalationResolveSlaMinutes: z.number().int().min(0).nullable().optional(),
          journeyResponseTargetPerWeek: z.number().int().min(0).nullable().optional(),
          npsTargetScore: z.number().int().min(0).max(100).nullable().optional(),
          csatTargetPercent: z.number().int().min(0).max(100).nullable().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return locationService.setSlaTarget(input, ctx.user.sub)
      }),

    bulkSetSlaTarget: protectedProcedure
      .input(
        z.object({
          locationIds: z.array(z.string().uuid()).min(1).max(100),
          target: z.object({
            reviewResponseSlaMinutes: z.number().int().min(0).nullable().optional(),
            escalationResolveSlaMinutes: z.number().int().min(0).nullable().optional(),
            journeyResponseTargetPerWeek: z.number().int().min(0).nullable().optional(),
            npsTargetScore: z.number().int().min(0).max(100).nullable().optional(),
            csatTargetPercent: z.number().int().min(0).max(100).nullable().optional(),
          }),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return locationService.bulkSetSlaTarget(input, ctx.user.sub)
      }),

    getSlaTarget: protectedProcedure
      .input(z.object({ locationId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return locationService.getSlaTarget(input.locationId, ctx.user.sub)
      }),
  })
}
