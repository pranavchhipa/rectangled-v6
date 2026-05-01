import { protectedProcedure, router } from '../trpc/middleware'
import {
  getOnboardingStateSchema,
  updateOnboardingStepSchema,
  completeOnboardingSchema,
  setOnboardingFlowSchema,
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

    complete: protectedProcedure.input(completeOnboardingSchema).mutation(async ({ input, ctx }) => {
      return service.complete(input.workspaceId, ctx.user.sub)
    }),
  })
}
