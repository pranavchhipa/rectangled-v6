'use client'

/**
 * Phase 1 — Organization switcher.
 *
 * Visibility:
 *   - direct mode + 1 org → render a non-interactive org name only
 *   - any other case → dropdown with all orgs the user is a member of
 *
 * Switching:
 *   - Calls organization.switch on the server (sets the cookie).
 *   - Updates the local store on success.
 *   - Invalidates downstream tRPC queries so workspace list etc. refetch.
 */

import { useCallback } from 'react'
import { Building2, ChevronsUpDown, Check, Plus, Network, Briefcase } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'

const TYPE_LABEL: Record<'direct' | 'multi_location' | 'agency', string> = {
  direct: 'Direct',
  multi_location: 'Multi-location',
  agency: 'Agency',
}

const TYPE_ICON = {
  direct: Building2,
  multi_location: Network,
  agency: Briefcase,
} as const

export function OrgSwitcher() {
  const { organizations, currentOrganizationId, setCurrentOrganization } = useAuthStore()
  const utils = trpc.useUtils()
  const switchMutation = trpc.organization.switch.useMutation({
    onSuccess: (data) => {
      setCurrentOrganization(data.organizationId)
      // Invalidate queries that depend on org context.
      utils.organization.getCurrent.invalidate()
      utils.workspace.list.invalidate()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to switch organization')
    },
  })

  const current = organizations.find((o) => o.id === currentOrganizationId) ?? organizations[0]

  // Direct mode + 1 org → don't show the switcher
  const shouldHide =
    !current ||
    (organizations.length === 1 && current.type === 'direct')

  if (shouldHide) return null

  const handleSwitch = useCallback(
    (orgId: string) => {
      if (orgId === currentOrganizationId) return
      switchMutation.mutate({ organizationId: orgId })
    },
    [currentOrganizationId, switchMutation],
  )

  const Icon = current ? TYPE_ICON[current.type] : Building2

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-8 px-2 max-w-[220px]"
          disabled={switchMutation.isPending}
        >
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate text-sm font-medium">
            {current?.name ?? 'Organization'}
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Your organizations
        </DropdownMenuLabel>
        {organizations.map((o) => {
          const ItemIcon = TYPE_ICON[o.type]
          const isCurrent = o.id === currentOrganizationId
          return (
            <DropdownMenuItem
              key={o.id}
              onClick={() => handleSwitch(o.id)}
              className="cursor-pointer flex items-start gap-2 py-2"
            >
              <ItemIcon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{o.name}</span>
                  {isCurrent && <Check className="size-3.5 text-primary shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {TYPE_LABEL[o.type]}
                  </Badge>
                  <span>·</span>
                  <span>
                    {o.workspaceCount} workspace{o.workspaceCount === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span>
                    {o.memberCount} member{o.memberCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            window.location.href = '/dashboard/organization'
          }}
          className="cursor-pointer text-xs text-muted-foreground"
        >
          <Building2 className="size-3.5" />
          Manage organization
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toast.info('Creating a new org from here is coming soon')}
          className="cursor-pointer text-xs text-muted-foreground"
        >
          <Plus className="size-3.5" />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
