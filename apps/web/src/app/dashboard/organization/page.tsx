'use client'

import Link from 'next/link'
import {
  Building2,
  Network,
  Briefcase,
  Users,
  Layers,
  Calendar,
  Pencil,
  Palette,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const TYPE_LABEL: Record<'direct' | 'multi_location' | 'agency', string> = {
  direct: 'Direct (single business)',
  multi_location: 'Multi-location chain',
  agency: 'Agency',
}

const TYPE_ICON = {
  direct: Building2,
  multi_location: Network,
  agency: Briefcase,
} as const

const TYPE_DESCRIPTION = {
  direct:
    'Single business, single workspace. The org layer is hidden by default and the dashboard behaves like a classic SMB tool.',
  multi_location:
    'A brand with multiple branches. Workspaces represent locations or sub-brands; the chain rollup shows performance across all of them.',
  agency:
    'You manage other businesses’ reputations. Each client is a workspace; white-label settings apply your branding across the dashboard and public pages.',
} as const

export default function OrganizationOverviewPage() {
  const { currentOrganizationId } = useAuthStore()
  const orgQuery = trpc.organization.getById.useQuery(
    { organizationId: currentOrganizationId! },
    { enabled: !!currentOrganizationId },
  )

  if (!currentOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm">
        No organization selected.
      </div>
    )
  }

  if (orgQuery.isLoading || !orgQuery.data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const org = orgQuery.data
  const Icon = TYPE_ICON[org.type as keyof typeof TYPE_ICON]
  const isAdminOrOwner = org.myRole === 'org_owner' || org.myRole === 'org_admin'

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="size-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {org.name}
              <Badge variant="outline" className="text-xs">
                {TYPE_LABEL[org.type as keyof typeof TYPE_LABEL]}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {TYPE_DESCRIPTION[org.type as keyof typeof TYPE_DESCRIPTION]}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 font-mono">slug: {org.slug}</p>
          </div>
        </div>
        {isAdminOrOwner && (
          <Button variant="outline" size="sm" disabled>
            <Pencil className="size-3.5" />
            Edit (coming soon)
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Layers className="size-3.5" />
              Workspaces
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org.workspaceCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Users className="size-3.5" />
              Members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org.memberCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Calendar className="size-3.5" />
              Created
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {new Date(org.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Your role</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="text-xs">
              {org.myRole.replace('org_', '').replace(/^./, (c: string) => c.toUpperCase())}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/organization/members"
          className="block group rounded-xl"
        >
          <Card className="cursor-pointer transition-shadow group-hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Members
              </CardTitle>
              <CardDescription>
                Invite teammates, manage roles, scope workspace access.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {org.type === 'agency' && (
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="size-4 text-primary" />
                White-label
              </CardTitle>
              <CardDescription>
                Customize branding for your clients (coming soon — Phase 1 Stage F).
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  )
}
