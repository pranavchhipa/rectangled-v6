'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InviteMemberSheet } from './invite-member-sheet'

interface Member {
  id: string
  userId: string
  role: string
  acceptedAt?: string | null
  user: {
    name: string
    email: string
    avatarUrl?: string | null
  } | null
}

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  manager: 'secondary',
  staff: 'outline',
  viewer: 'outline',
}

const ASSIGNABLE_ROLES = ['manager', 'staff', 'viewer'] as const

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function MembersTable() {
  const queryClient = useQueryClient()
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  const currentUser = useAuthStore((s) => s.user)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)

  const { data: members, isLoading } = trpc.member.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const updateRoleMutation = trpc.member.updateRole.useMutation({
    onSuccess: () => {
      toast.success('Member role updated.')
      queryClient.invalidateQueries({ queryKey: [['member']] })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update role.')
    },
  })

  const removeMutation = trpc.member.remove.useMutation({
    onSuccess: () => {
      toast.success('Member removed from workspace.')
      setRemoveDialogOpen(false)
      setMemberToRemove(null)
      queryClient.invalidateQueries({ queryKey: [['member']] })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove member.')
    },
  })

  function handleChangeRole(memberId: string, role: string) {
    updateRoleMutation.mutate({ memberId, role: role as 'manager' | 'staff' | 'viewer' })
  }

  function handleRemoveClick(member: Member) {
    setMemberToRemove(member)
    setRemoveDialogOpen(true)
  }

  function handleConfirmRemove() {
    if (memberToRemove) {
      removeMutation.mutate({ memberId: memberToRemove.id })
    }
  }

  if (!currentWorkspaceId) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        No workspace selected. Please select a workspace first.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-xl border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const membersList = (members ?? []) as Member[]

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Team Members</h3>
            <p className="text-sm text-muted-foreground">
              {membersList.length} member{membersList.length !== 1 ? 's' : ''} in this workspace
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>Invite Member</Button>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No members found. Invite someone to get started.
                  </TableCell>
                </TableRow>
              ) : (
                membersList.map((member) => {
                  const isCurrentUser = member.userId === currentUser?.id
                  const isOwner = member.role === 'owner'

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar size="default">
                            {member.user?.avatarUrl && (
                              <AvatarImage
                                src={member.user.avatarUrl}
                                alt={member.user?.name ?? 'User'}
                              />
                            )}
                            <AvatarFallback>
                              {getInitials(member.user?.name ?? '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.user?.name ?? 'Unknown'}
                              {isCurrentUser && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.user?.email ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE_VARIANT[member.role] ?? 'outline'}>
                          {formatRole(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.acceptedAt ? 'secondary' : 'outline'
                          }
                        >
                          {member.acceptedAt ? 'Accepted' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!isOwner && !isCurrentUser && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  Change Role
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {ASSIGNABLE_ROLES.map((role) => (
                                    <DropdownMenuItem
                                      key={role}
                                      disabled={member.role === role}
                                      onClick={() =>
                                        handleChangeRole(member.id, role)
                                      }
                                    >
                                      {formatRole(role)}
                                      {member.role === role && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                          Current
                                        </span>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleRemoveClick(member)}
                              >
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <InviteMemberSheet open={inviteOpen} onOpenChange={setInviteOpen} />

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">
                {memberToRemove?.user?.name ?? 'this member'}
              </span>{' '}
              from this workspace? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={removeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
