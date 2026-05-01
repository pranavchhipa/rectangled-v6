import {
  protectedProcedure,
  publicProcedure,
  router,
} from '../trpc/middleware'
import {
  listOrganizationsSchema,
  getOrganizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  updateOrganizationTypeSchema,
  deleteOrganizationSchema,
  switchOrganizationSchema,
  getWhiteLabelSchema,
} from '@rectangled/shared'
import { OrganizationService } from './organization.service'

export function createOrganizationRouter(service: OrganizationService) {
  return router({
    list: protectedProcedure
      .input(listOrganizationsSchema)
      .query(async ({ ctx }) => {
        return service.list(ctx.user.sub)
      }),

    getById: protectedProcedure
      .input(getOrganizationSchema)
      .query(async ({ input, ctx }) => {
        return service.getById(input.organizationId, ctx.user.sub)
      }),

    create: protectedProcedure
      .input(createOrganizationSchema)
      .mutation(async ({ input, ctx }) => {
        return service.create(input, ctx.user.sub)
      }),

    update: protectedProcedure
      .input(updateOrganizationSchema)
      .mutation(async ({ input, ctx }) => {
        return service.update(input, ctx.user.sub)
      }),

    updateType: protectedProcedure
      .input(updateOrganizationTypeSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateType(input, ctx.user.sub)
      }),

    delete: protectedProcedure
      .input(deleteOrganizationSchema)
      .mutation(async ({ input, ctx }) => {
        return service.delete(input.organizationId, ctx.user.sub)
      }),

    /**
     * Phase 1 Stage D will wire the cookie-setting side-effect. In Stage C
     * the mutation just verifies the user is a member; the cookie work is
     * deferred to keep this stage focused on data-layer changes.
     */
    switch: protectedProcedure
      .input(switchOrganizationSchema)
      .mutation(async ({ input, ctx }) => {
        // Stage C: validate membership; Stage D will set the cookie too.
        await service.getById(input.organizationId, ctx.user.sub)
        return { success: true as const, organizationId: input.organizationId }
      }),

    /**
     * Public: white-label config lookup by org slug. Used by login page
     * and public pages to theme themselves without authentication.
     */
    getWhiteLabel: publicProcedure
      .input(getWhiteLabelSchema)
      .query(async ({ input }) => {
        return service.getWhiteLabelBySlug(input.slug)
      }),
  })
}
