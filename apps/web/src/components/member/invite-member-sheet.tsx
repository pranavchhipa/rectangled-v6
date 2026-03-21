'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const INVITE_ROLES = ['manager', 'staff', 'viewer'] as const

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

interface InviteMemberSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteMemberSheet({ open, onOpenChange }: InviteMemberSheetProps) {
  const queryClient = useQueryClient()
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'manager' | 'staff' | 'viewer'>('staff')

  const inviteMutation = trpc.member.invite.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${email}.`)
      queryClient.invalidateQueries({ queryKey: [['member']] })
      resetForm()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invitation.')
    },
  })

  function resetForm() {
    setEmail('')
    setRole('staff')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!currentWorkspaceId) {
      toast.error('No workspace selected.')
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error('Email address is required.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Please enter a valid email address.')
      return
    }

    if (!role) {
      toast.error('Please select a role.')
      return
    }

    inviteMutation.mutate({
      workspaceId: currentWorkspaceId,
      email: trimmedEmail,
      role,
    })
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetForm()
    }
    onOpenChange(isOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Invite Member</SheetTitle>
          <SheetDescription>
            Send an invitation to add a new member to this workspace.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 flex-1">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'manager' | 'staff' | 'viewer')}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {formatRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'manager'
                ? 'Managers can manage locations, members, and settings.'
                : role === 'staff'
                  ? 'Staff can view data and respond to reviews.'
                  : 'Viewers have read-only access to the workspace.'}
            </p>
          </div>
        </form>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={inviteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit as unknown as () => void}
            disabled={inviteMutation.isPending || !email.trim()}
          >
            {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
