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

/**
 * Phase 1 — local cache of the org context. Hydrated on app load via the
 * tRPC `organization.list` + `organization.getCurrent` calls. The server
 * is the source of truth (cookie-based); this is purely for snappy UI.
 */
export interface AuthOrg {
  id: string
  name: string
  slug: string
  type: 'direct' | 'multi_location' | 'agency'
  myRole: 'org_owner' | 'org_admin' | 'org_manager' | 'org_member'
  workspaceCount: number
  memberCount: number
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  memberships: Membership[]
  currentWorkspaceId: string | null

  // Phase 1 — organization layer
  organizations: AuthOrg[]
  currentOrganizationId: string | null

  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  setMemberships: (memberships: Membership[]) => void
  setCurrentWorkspace: (workspaceId: string) => void
  setOrganizations: (orgs: AuthOrg[]) => void
  setCurrentOrganization: (orgId: string | null) => void
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
      organizations: [],
      currentOrganizationId: null,

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

      setOrganizations: (orgs) =>
        set((state) => ({
          organizations: orgs,
          // Auto-pick when none selected or current is no longer valid.
          currentOrganizationId:
            state.currentOrganizationId &&
            orgs.some((o) => o.id === state.currentOrganizationId)
              ? state.currentOrganizationId
              : orgs[0]?.id ?? null,
        })),

      setCurrentOrganization: (orgId) =>
        set({ currentOrganizationId: orgId }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          memberships: [],
          currentWorkspaceId: null,
          organizations: [],
          currentOrganizationId: null,
        }),
    }),
    {
      name: 'rectangled-auth',
    }
  )
)
