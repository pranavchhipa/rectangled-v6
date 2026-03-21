import type { Role } from '../constants/roles'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  googleId: string | null
  emailVerified: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Member {
  id: string
  userId: string
  workspaceId: string
  role: Role
  locationIds: string[]
  invitedBy: string | null
  acceptedAt: Date | null
  createdAt: Date
}

/** User with their membership info for the current workspace */
export interface AuthenticatedUser extends User {
  membership: Member
}
