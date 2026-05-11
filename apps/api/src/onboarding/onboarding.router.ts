import { protectedProcedure, router } from '../trpc/middleware'
import {
  getOnboardingStateSchema,
  updateOnboardingStepSchema,
  completeOnboardingSchema,
  setOnboardingFlowSchema,
  getRedirectLinksSchema,
  setRedirectLinksSchema,
  searchGooglePlacesSchema,
} from '@rectangled/shared'
import { OnboardingService } from './onboarding.service'

export function createOnboardingRouter(service: OnboardingService) {
  return router({
    getState: protectedProcedure.input(getOnboardingStateSchema).query(async ({ input, ctx }) => {
      return service.getState(input.workspaceId, ctx.user.sub)
    }),

    updateStep: protectedProcedure
      .input(updateOnboardingStepSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateStep(input.workspaceId, input.step, ctx.user.sub)
      }),

    setFlow: protectedProcedure
      .input(setOnboardingFlowSchema)
      .mutation(async ({ input, ctx }) => {
        return service.setFlow(input.workspaceId, input.flow, ctx.user.sub)
      }),

    // Phase 2 — review-platform redirect URLs (Onboarding hard requirement).
    getRedirectLinks: protectedProcedure
      .input(getRedirectLinksSchema)
      .query(async ({ input, ctx }) => {
        return service.getRedirectLinks(input.workspaceId, ctx.user.sub)
      }),

    setRedirectLinks: protectedProcedure
      .input(setRedirectLinksSchema)
      .mutation(async ({ input, ctx }) => {
        return service.setRedirectLinks(
          input.workspaceId,
          input.redirectLinks,
          ctx.user.sub,
          input.googlePlaceId,
        )
      }),

    // Phase 2.1 — Places API search for auto-resolving Google review URL.
    searchGooglePlaces: protectedProcedure
      .input(searchGooglePlacesSchema)
      .query(async ({ input, ctx }) => {
        return service.searchGooglePlaces(
          input.workspaceId,
          input.query,
          ctx.user.sub,
        )
      }),

    complete: protectedProcedure.input(completeOnboardingSchema).mutation(async ({ input, ctx }) => {
      return service.complete(input.workspaceId, ctx.user.sub)
    }),
  })
}
