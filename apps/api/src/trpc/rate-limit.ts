import { TRPCError } from '@trpc/server'

// Simple in-memory rate limiter for tRPC procedures
const attempts = new Map<string, { count: number; resetAt: number }>()

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of attempts) {
    if (val.resetAt < now) attempts.delete(key)
  }
}, 60_000)

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): void {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  entry.count++
  if (entry.count > maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
    })
  }
}
