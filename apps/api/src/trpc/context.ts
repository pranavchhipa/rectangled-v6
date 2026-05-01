import * as jwt from 'jsonwebtoken'
import type { JwtPayload } from '@rectangled/shared'

export const CURRENT_ORG_COOKIE = 'rectangled_current_organization_id'

export interface TrpcContext {
  user: JwtPayload | null
  /**
   * Phase 1 — current organization context. Read from the
   * `rectangled_current_organization_id` cookie. Membership is NOT verified
   * here (kept fast); services that depend on the org call requireOrgAccess
   * which does the membership check.
   */
  currentOrganizationId: string | null
  req: Request | null
  /**
   * Phase 1 — outbound cookie patches. Procedures (e.g. organization.switch)
   * push entries here; the trpc HTTP layer reads them after the response
   * resolves and writes Set-Cookie headers. Empty array by default.
   */
  responseCookies: Array<{ name: string; value: string; maxAge?: number; clear?: boolean }>
}

export function createTrpcContext(req: Request): TrpcContext {
  const authHeader =
    req.headers instanceof Headers
      ? req.headers.get('authorization')
      : (req.headers as any)?.authorization

  const cookieHeader =
    req.headers instanceof Headers
      ? req.headers.get('cookie')
      : (req.headers as any)?.cookie

  const currentOrganizationId = parseCookie(cookieHeader, CURRENT_ORG_COOKIE)

  let user: JwtPayload | null = null
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const secret = process.env.JWT_SECRET
      if (!secret && process.env.NODE_ENV === 'production') {
        // No-op: leave user null
      } else {
        const jwtSecret = secret || 'dev-only-insecure-jwt-secret-not-for-production-use'
        user = jwt.verify(token, jwtSecret) as JwtPayload
      }
    } catch {
      user = null
    }
  }

  return {
    user,
    currentOrganizationId,
    req,
    responseCookies: [],
  }
}

/**
 * Tiny dependency-free cookie parser — pulls one named cookie out of a
 * `Cookie:` header value. Returns null when missing.
 */
function parseCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const raw of parts) {
    const trimmed = raw.trim()
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1))
    }
  }
  return null
}
