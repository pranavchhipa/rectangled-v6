import { protectedProcedure, router } from '../trpc/middleware'
import { z } from 'zod'
import { EmailService } from './email.service'

export function createEmailRouter(service: EmailService) {
  return router({
    sendTestEmail: protectedProcedure
      .input(z.object({ to: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        await service.sendWelcomeEmail(
          input.to,
          ctx.user.email ?? 'User',
          'Rectangled.io (Test)',
        )
        return { success: true, message: `Test email sent to ${input.to}` }
      }),
  })
}
