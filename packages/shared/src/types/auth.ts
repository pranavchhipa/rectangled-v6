import type { User, Member } from './user'

export interface JwtPayload {
  sub: string // user id
  email: string
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface MeResponse {
  user: User
  memberships: Array<{
    workspaceId: string
    workspaceName: string
    workspaceSlug: string
    role: Member['role']
  }>
}
