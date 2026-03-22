import { protectedProcedure, router } from '../trpc/middleware'
import { z } from 'zod'
import { AiAgentService } from './ai-agent.service'
import { EmailService } from '../email/email.service'
import { checkRateLimit } from '../trpc/rate-limit'

export function createAiAgentRouter(aiAgentService: AiAgentService, emailService: EmailService) {
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

    raiseTicket: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          subject: z.string().min(1).max(200),
          description: z.string().min(1).max(5000),
          priority: z.enum(['low', 'medium', 'high']),
          userEmail: z.string().email(),
        }),
      )
      .mutation(async ({ input }) => {
        const ticketRef = `TKT-${Date.now()}`
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

        const subject = `[Ticket] ${input.priority.toUpperCase()} - ${input.subject}`
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: ${input.priority === 'high' ? '#dc2626' : input.priority === 'medium' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 20px 24px;">
      <h2 style="margin: 0; font-size: 18px;">New Support Ticket: ${ticketRef}</h2>
      <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Priority: ${input.priority.toUpperCase()}</p>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Ticket Reference</td>
          <td style="padding: 8px 0; font-weight: 600;">${ticketRef}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Workspace ID</td>
          <td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${input.workspaceId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">User Email</td>
          <td style="padding: 8px 0;">${input.userEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted At</td>
          <td style="padding: 8px 0;">${timestamp}</td>
        </tr>
      </table>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 8px;">
        <p style="margin: 0 0 4px; font-weight: 600; font-size: 14px; color: #374151;">Subject</p>
        <p style="margin: 0 0 16px; font-size: 14px;">${input.subject}</p>
        <p style="margin: 0 0 4px; font-weight: 600; font-size: 14px; color: #374151;">Description</p>
        <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${input.description}</p>
      </div>
    </div>
  </div>
</body>
</html>`

        await emailService.sendTicketEmail(
          'support@rectangled.io',
          subject,
          html,
        )

        return { ticketRef }
      }),
  })
}
