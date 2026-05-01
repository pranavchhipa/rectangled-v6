'use client'

/**
 * Phase 1 Stage F — applies the current org's white-label CSS variables
 * to its descendants. Wrapped around the dashboard inset so every dashboard
 * page automatically picks up the theme without each page knowing about it.
 *
 * Variables we currently expose:
 *   --org-primary       (override --primary if set)
 *   --org-secondary     (override --secondary if set)
 *
 * Components opt in by referencing these. We don't blanket-replace --primary
 * because it would also re-theme components like dialogs/buttons mid-stream
 * which is jarring. Instead, an `org-themed` utility class can be added per
 * component as we onboard them.
 *
 * Direct mode + no white-label config → no-op (just renders children).
 * Custom logo / footer text are rendered by the components that consume
 * them (header logo replacement, footer in /j/ /f/ pages — Stage G+).
 */

import { useMemo } from 'react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'

type WhiteLabel = {
  enabled?: boolean
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  faviconUrl?: string
  footerText?: string
  supportEmail?: string
  supportPhone?: string
  customDomain?: string
}

export function WhiteLabelTheme({ children }: { children: React.ReactNode }) {
  const { currentOrganizationId } = useAuthStore()
  const orgQuery = trpc.organization.getById.useQuery(
    { organizationId: currentOrganizationId! },
    { enabled: !!currentOrganizationId, staleTime: 5 * 60 * 1000 },
  )

  const wl = (orgQuery.data?.whiteLabel ?? {}) as WhiteLabel

  const style = useMemo(() => {
    if (!wl.enabled) return {}
    const out: Record<string, string> = {}
    if (wl.primaryColor) out['--org-primary'] = wl.primaryColor
    if (wl.secondaryColor) out['--org-secondary'] = wl.secondaryColor
    return out
  }, [wl.enabled, wl.primaryColor, wl.secondaryColor])

  // We render a div wrapper rather than mutating <html> globally so SSR
  // boundaries are clean and theme switches don't flash.
  return (
    <div className="contents" style={style as React.CSSProperties}>
      {children}
    </div>
  )
}
