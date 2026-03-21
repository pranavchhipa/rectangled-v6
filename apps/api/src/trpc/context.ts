import * as jwt from 'jsonwebtoken'
import type { JwtPayload } from '@rectangled/shared'

export interface TrpcContext {
  user: JwtPayload | null
  req: Request | null
}

export function createTrpcContext(req: Request): TrpcContext {
  const authHeader =
    req.headers instanceof Headers
      ? req.headers.get('authorization')
      : (req.headers as any)?.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, req }
  }

  const token = authHeader.slice(7)
  try {
    const secret = process.env.JWT_SECRET
    if (!secret && process.env.NODE_ENV === 'production') {
      return { user: null, req }
    }
    const jwtSecret = secret || 'dev-only-insecure-jwt-secret-not-for-production-use'
    const payload = jwt.verify(token, jwtSecret) as JwtPayload
    return { user: payload, req }
  } catch {
    return { user: null, req }
  }
}
