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
import { CURRENT_ORG_COOKIE } from '../trpc/context'

// 1 year — long enough for the user not to feel the switcher reset.
const SWITCH_COOKIE_TTL_SECONDS = 365 * 24 * 60 * 60

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
     * Phase 1 Stage D — verify membership AND set the current-org cookie.
     * The trpc HTTP layer reads ctx.responseCookies after the procedure
     * resolves and emits the Set-Cookie header.
     */
    switch: protectedProcedure
      .input(switchOrganizationSchema)
      .mutation(async ({ input, ctx }) => {
        await service.getById(input.organizationId, ctx.user.sub)
        ctx.responseCookies.push({
          name: CURRENT_ORG_COOKIE,
          value: input.organizationId,
          maxAge: SWITCH_COOKIE_TTL_SECONDS,
        })
        return { success: true as const, organizationId: input.organizationId }
      }),

    /**
     * Phase 1 Stage D — clear the current-org cookie. Used on logout / when
     * switching to a workspace that lives in a different org. (The frontend
     * also calls this if it detects the cookie points at an org the user
     * is no longer a member of.)
     */
    clearCurrent: protectedProcedure
      .mutation(async ({ ctx }) => {
        ctx.responseCookies.push({
          name: CURRENT_ORG_COOKIE,
          value: '',
          clear: true,
        })
        return { success: true as const }
      }),

    /**
     * Phase 1 Stage D — return the current-org context. Frontend hydrates
     * its Zustand store on app load by calling this. Returns null when no
     * cookie is set OR when the cookie points at an org the caller isn't
     * a member of (e.g. they were removed since their last visit).
     */
    getCurrent: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.currentOrganizationId
      if (!orgId) return null
      try {
        return await service.getById(orgId, ctx.user.sub)
      } catch {
        // Cookie points at an org we no longer have access to — silently
        // return null so the frontend falls back to picking from list().
        return null
      }
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
