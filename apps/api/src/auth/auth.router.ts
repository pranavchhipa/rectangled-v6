import { publicProcedure, protectedProcedure, router } from '../trpc/middleware'
import { registerSchema, loginSchema, refreshTokenSchema, googleCallbackSchema } from '@rectangled/shared'
import { z } from 'zod'
import { AuthService } from './auth.service'
import { checkRateLimit } from '../trpc/rate-limit'

function getIp(req: Request | null): string {
  if (!req) return 'unknown'
  return req.headers instanceof Headers
    ? req.headers.get('x-forwarded-for') || 'unknown'
    : (req.headers as any)?.['x-forwarded-for'] || 'unknown'
}

export function createAuthRouter(authService: AuthService) {
  return router({
    register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
      const ip = getIp(ctx.req)
      checkRateLimit(`register:${ip}`, 3, 300_000) // 3 registrations per 5 min per IP
      return authService.register(input.name, input.email, input.password)
    }),

    login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
      const ip = getIp(ctx.req)
      checkRateLimit(`login:${ip}`, 5, 60_000) // 5 attempts per minute per IP
      checkRateLimit(`login:${input.email}`, 10, 300_000) // 10 attempts per 5 min per email
      return authService.login(input.email, input.password)
    }),

    googleAuthUrl: publicProcedure
      .input(z.object({ redirectUrl: z.string().url().optional() }).optional())
      .query(({ input }) => {
        return { url: authService.getGoogleAuthUrl(input?.redirectUrl) }
      }),

    googleCallback: publicProcedure.input(googleCallbackSchema).mutation(async ({ input }) => {
      return authService.googleCallback(input.code, input.redirectUrl)
    }),

    refresh: publicProcedure.input(refreshTokenSchema).mutation(async ({ input, ctx }) => {
      const ip = getIp(ctx.req)
      checkRateLimit(`refresh:${ip}`, 10, 60_000) // 10 refreshes per minute per IP
      return authService.refresh(input.refreshToken)
    }),

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const ip = getIp(ctx.req)
        checkRateLimit(`forgotPassword:${ip}`, 3, 300_000) // 3 requests per 5 min per IP
        return authService.forgotPassword(input.email)
      }),

    resetPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        token: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = getIp(ctx.req)
        checkRateLimit(`resetPassword:${ip}`, 5, 300_000) // 5 attempts per 5 min per IP
        return authService.resetPassword(input.email, input.token, input.newPassword)
      }),

    me: protectedProcedure.query(async ({ ctx }) => {
      return authService.me(ctx.user.sub)
    }),

    requestEmailVerification: protectedProcedure.mutation(async ({ ctx }) => {
      return authService.requestEmailVerification(ctx.user.sub)
    }),

    logout: protectedProcedure.mutation(async () => {
      return { success: true }
    }),
  })
}
