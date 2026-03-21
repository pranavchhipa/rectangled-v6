import { protectedProcedure, router } from '../trpc/middleware'
import { z } from 'zod'
import { AiAgentService } from './ai-agent.service'
import { checkRateLimit } from '../trpc/rate-limit'

export function createAiAgentRouter(aiAgentService: AiAgentService) {
  return router({
    chat: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          message: z.string().min(1).max(2000),
          history: z
            .array(
              z.object({
                role: z.enum(['user', 'assistant']),
                content: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        checkRateLimit(`ai-chat:${ctx.user.sub}`, 15, 60_000) // 15 chat messages per minute per user
        return aiAgentService.chat(input, ctx.user.sub)
      }),
  })
}
