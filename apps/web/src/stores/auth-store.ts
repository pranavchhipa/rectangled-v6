'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Membership {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  role: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  memberships: Membership[]
  currentWorkspaceId: string | null

  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  setMemberships: (memberships: Membership[]) => void
  setCurrentWorkspace: (workspaceId: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      memberships: [],
      currentWorkspaceId: null,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      setMemberships: (memberships) =>
        set((state) => ({
          memberships,
          // Auto-select first workspace if none selected
          currentWorkspaceId:
            state.currentWorkspaceId &&
            memberships.some((m) => m.workspaceId === state.currentWorkspaceId)
              ? state.currentWorkspaceId
              : memberships[0]?.workspaceId ?? null,
        })),

      setCurrentWorkspace: (workspaceId) =>
        set({ currentWorkspaceId: workspaceId }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          memberships: [],
          currentWorkspaceId: null,
        }),
    }),
    {
      name: 'rectangled-auth',
    }
  )
)
