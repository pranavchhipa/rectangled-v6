'use client'

/**
 * Phase 1 — sync the local org cache with the server on app load.
 *
 *   1. organization.list → fill in `organizations` and pick a default if none.
 *   2. organization.getCurrent → if the cookie was set previously, prefer
 *      that org over the auto-pick.
 *
 * This is a tiny client-only effect with no UI. Mount it once near the top
 * of the dashboard tree.
 */

import { useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import type { AuthOrg } from '@/stores/auth-store'

export function OrgHydrator() {
  const setOrganizations = useAuthStore((s) => s.setOrganizations)
  const setCurrentOrganization = useAuthStore((s) => s.setCurrentOrganization)
  const accessToken = useAuthStore((s) => s.accessToken)

  const listQuery = trpc.organization.list.useQuery(
    {},
    {
      enabled: !!accessToken,
      staleTime: 5 * 60 * 1000, // 5 minutes — orgs change rarely
    },
  )
  const currentQuery = trpc.organization.getCurrent.useQuery(undefined, {
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  })

  // Sync list → store
  useEffect(() => {
    if (!listQuery.data) return
    const mapped: AuthOrg[] = listQuery.data.map((o: any) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: o.type,
      myRole: o.myRole,
      workspaceCount: o.workspaceCount,
      memberCount: o.memberCount,
    }))
    setOrganizations(mapped)
  }, [listQuery.data, setOrganizations])

  // Sync server-side current → store, if the cookie pointed at something valid
  useEffect(() => {
    if (currentQuery.data?.id) {
      setCurrentOrganization(currentQuery.data.id)
    }
  }, [currentQuery.data?.id, setCurrentOrganization])

  return null
}
