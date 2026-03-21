import { protectedProcedure, router } from '../trpc/middleware'
import {
  listScheduledSchema,
  generateAiResponseSchema,
  scheduleResponseSchema,
  cancelScheduleSchema,
  getAiSettingsSchema,
  updateAiSettingsSchema,
  getDailyCountsSchema,
} from '@rectangled/shared'
import { AiResponseAutomationService } from './ai-response.service'
import { checkRateLimit } from '../trpc/rate-limit'

export function createAiResponseRouter(
  aiResponseAutomationService: AiResponseAutomationService
) {
  return router({
    listScheduled: protectedProcedure
      .input(listScheduledSchema)
      .query(async ({ input, ctx }) => {
        return aiResponseAutomationService.listScheduled(
          input.workspaceId,
          input.status,
          input.page,
          input.limit,
          ctx.user.sub
        )
      }),

    generateResponse: protectedProcedure
      .input(generateAiResponseSchema)
      .mutation(async ({ input, ctx }) => {
        checkRateLimit(`ai:${ctx.user.sub}`, 20, 60_000) // 20 AI calls per minute per user
        return aiResponseAutomationService.generateResponse(
          input.reviewId,
          ctx.user.sub
        )
      }),

    scheduleResponse: protectedProcedure
      .input(scheduleResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return aiResponseAutomationService.scheduleResponse(
          input.reviewId,
          input.scheduledFor,
          ctx.user.sub
        )
      }),

    cancelSchedule: protectedProcedure
      .input(cancelScheduleSchema)
      .mutation(async ({ input, ctx }) => {
        return aiResponseAutomationService.cancelSchedule(
          input.scheduleId,
          ctx.user.sub
        )
      }),

    getSettings: protectedProcedure
      .input(getAiSettingsSchema)
      .query(async ({ input, ctx }) => {
        // TODO: Implement settings table — return defaults for now
        return {
          workspaceId: input.workspaceId,
          enabled: false,
          dailyLimit: 50,
          minDelayMinutes: 15,
          maxDelayMinutes: 240,
          tone: 'professional' as const,
        }
      }),

    updateSettings: protectedProcedure
      .input(updateAiSettingsSchema)
      .mutation(async ({ input, ctx }) => {
        // TODO: Implement settings persistence
        return {
          workspaceId: input.workspaceId,
          enabled: input.enabled ?? false,
          dailyLimit: input.dailyLimit ?? 50,
          minDelayMinutes: input.minDelayMinutes ?? 15,
          maxDelayMinutes: input.maxDelayMinutes ?? 240,
          tone: input.tone ?? 'professional',
        }
      }),

    getDailyCounts: protectedProcedure
      .input(getDailyCountsSchema)
      .query(async ({ input, ctx }) => {
        return aiResponseAutomationService.getDailyCounts(
          input.locationId,
          input.startDate,
          input.endDate,
          ctx.user.sub
        )
      }),

    getAiResponseCount: protectedProcedure
      .input(getAiSettingsSchema)
      .query(async ({ input, ctx }) => {
        return aiResponseAutomationService.getAiResponseCount(
          input.workspaceId,
          ctx.user.sub
        )
      }),
  })
}
