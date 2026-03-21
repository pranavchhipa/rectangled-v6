'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'

interface CustomerFormData {
  id: string
  name: string
  email: string | null
  phone: string | null
  tags: string[]
}

interface CustomerFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: CustomerFormData
}

export function CustomerFormSheet({
  open,
  onOpenChange,
  customer,
}: CustomerFormSheetProps) {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()
  const isEdit = !!customer

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  // Reset form when sheet opens or customer changes
  useEffect(() => {
    if (open) {
      setName(customer?.name ?? '')
      setEmail(customer?.email ?? '')
      setPhone(customer?.phone ?? '')
      setTagsInput(customer?.tags?.join(', ') ?? '')
    }
  }, [open, customer])

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      toast.success('Customer created successfully')
      utils.customer.list.invalidate()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create customer')
    },
  })

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      toast.success('Customer updated successfully')
      utils.customer.list.invalidate()
      utils.customer.getById.invalidate()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update customer')
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const parseTags = (input: string): string[] => {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Customer name is required')
      return
    }

    const tags = parseTags(tagsInput)

    if (isEdit && customer) {
      updateMutation.mutate({
        customerId: customer.id,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        tags,
      })
    } else {
      if (!currentWorkspaceId) {
        toast.error('No workspace selected')
        return
      }
      createMutation.mutate({
        workspaceId: currentWorkspaceId,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        tags,
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Customer' : 'Add Customer'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the customer details below.'
              : 'Fill in the details to add a new customer.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="customer-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer-name"
              placeholder="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-tags">Tags</Label>
            <Input
              id="customer-tags"
              placeholder="vip, returning, wholesale"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas.
            </p>
          </div>

          <SheetFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? 'Saving...'
                  : 'Creating...'
                : isEdit
                  ? 'Save Changes'
                  : 'Add Customer'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
