'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Loader2, Copy, Check } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

const ROLE_LABEL: Record<'org_owner' | 'org_admin' | 'org_manager' | 'org_member', string> = {
  org_owner: 'Owner',
  org_admin: 'Admin',
  org_manager: 'Manager',
  org_member: 'Member',
}

const ROLE_DESCRIPTION = {
  org_owner: 'Full control of the org and all workspaces. Can delete the org.',
  org_admin: 'Manage workspaces, members, and billing. Cannot delete the org.',
  org_manager: 'Operate across assigned workspaces. Read all, write some.',
  org_member: 'Limited access — only the workspaces explicitly assigned.',
} as const

export default function OrganizationMembersPage() {
  const { currentOrganizationId } = useAuthStore()
  const utils = trpc.useUtils()

  const orgQuery = trpc.organization.getById.useQuery(
    { organizationId: currentOrganizationId! },
    { enabled: !!currentOrganizationId },
  )
  const membersQuery = trpc.organizationMember.list.useQuery(
    { organizationId: currentOrganizationId! },
    { enabled: !!currentOrganizationId },
  )

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'org_manager' | 'org_member'>(
    'org_member',
  )
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  const inviteMutation = trpc.organizationMember.invite.useMutation({
    onSuccess: (data) => {
      setGeneratedToken(data.invitationToken)
      utils.organizationMember.list.invalidate({ organizationId: currentOrganizationId! })
      toast.success(`Invited ${data.inviteeEmail}`)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to invite')
    },
  })

  const removeMutation = trpc.organizationMember.remove.useMutation({
    onSuccess: () => {
      utils.organizationMember.list.invalidate({ organizationId: currentOrganizationId! })
      toast.success('Member removed')
    },
    onError: (err) => toast.error(err.message || 'Failed to remove'),
  })

  const updateRoleMutation = trpc.organizationMember.updateRole.useMutation({
    onSuccess: () => {
      utils.organizationMember.list.invalidate({ organizationId: currentOrganizationId! })
      toast.success('Role updated')
    },
    onError: (err) => toast.error(err.message || 'Failed to update role'),
  })

  const myRole = orgQuery.data?.myRole
  const canInvite = myRole === 'org_owner' || myRole === 'org_admin'
  const canChangeRole = myRole === 'org_owner'

  function handleInvite() {
    if (!inviteEmail.trim() || !currentOrganizationId) return
    setGeneratedToken(null)
    setTokenCopied(false)
    inviteMutation.mutate({
      organizationId: currentOrganizationId,
      email: inviteEmail.trim(),
      role: inviteRole,
    })
  }

  function copyToken() {
    if (!generatedToken) return
    const inviteUrl = `${window.location.origin}/accept-invite?token=${generatedToken}`
    navigator.clipboard.writeText(inviteUrl)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 2000)
  }

  function resetInviteDialog() {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteRole('org_member')
    setGeneratedToken(null)
    setTokenCopied(false)
  }

  if (!currentOrganizationId) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>
  }

  const members = membersQuery.data ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Organization members</h1>
          <p className="text-sm text-muted-foreground">
            Invite teammates, set their roles, and scope which workspaces they can access.
          </p>
        </div>
        {canInvite && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="size-4" />
            Invite member
          </Button>
        )}
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Members ({members.length})
          </CardTitle>
          <CardDescription>
            Pending invites are shown alongside accepted members.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {membersQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No members yet. Invite someone to start collaborating.
            </div>
          ) : (
            <div className="divide-y">
              {members.map((m: any) => {
                const isPending = !m.acceptedAt
                const initials =
                  (m.userName ?? m.userEmail ?? '?')
                    .split(/\s+|@/)
                    .map((s: string) => s[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {m.userName ?? m.userEmail ?? 'Unknown'}
                        </span>
                        {isPending && (
                          <Badge variant="outline" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.userEmail}</div>
                      {m.workspaceIds && m.workspaceIds.length > 0 && (
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Scoped to {m.workspaceIds.length} workspace
                          {m.workspaceIds.length === 1 ? '' : 's'}
                        </div>
                      )}
                    </div>
                    <Badge variant={m.role === 'org_owner' ? 'default' : 'secondary'} className="text-[10px]">
                      {ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]}
                    </Badge>
                    {(canChangeRole || canInvite) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canChangeRole && (
                            <>
                              <DropdownMenuLabel className="text-xs font-normal">
                                Change role
                              </DropdownMenuLabel>
                              {(['org_owner', 'org_admin', 'org_manager', 'org_member'] as const).map(
                                (r) => (
                                  <DropdownMenuItem
                                    key={r}
                                    disabled={m.role === r}
                                    onClick={() =>
                                      updateRoleMutation.mutate({
                                        organizationId: currentOrganizationId,
                                        memberId: m.id,
                                        role: r,
                                      })
                                    }
                                  >
                                    {ROLE_LABEL[r]}
                                  </DropdownMenuItem>
                                ),
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm(`Remove ${m.userEmail ?? m.userName} from the organization?`)) {
                                removeMutation.mutate({
                                  organizationId: currentOrganizationId,
                                  memberId: m.id,
                                })
                              }
                            }}
                          >
                            Remove from organization
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!open) resetInviteDialog()
          else setInviteOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They'll get an invite link. Their access kicks in when they accept.
            </DialogDescription>
          </DialogHeader>

          {generatedToken ? (
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/50 p-3 space-y-2">
                <Label className="text-xs">Invite link</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs truncate bg-background border rounded px-2 py-1">
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${generatedToken.slice(
                      0,
                      32,
                    )}…`}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyToken}>
                    {tokenCopied ? (
                      <>
                        <Check className="size-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The link is valid for 7 days. Send it to the invitee.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org_admin">{ROLE_LABEL.org_admin}</SelectItem>
                    <SelectItem value="org_manager">{ROLE_LABEL.org_manager}</SelectItem>
                    <SelectItem value="org_member">{ROLE_LABEL.org_member}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {ROLE_DESCRIPTION[inviteRole]}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetInviteDialog}>
              {generatedToken ? 'Done' : 'Cancel'}
            </Button>
            {!generatedToken && (
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Send invite'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
