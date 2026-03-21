'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface LocationData {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  timezone: string
  phone: string | null
  email: string | null
  isActive: boolean
  ownerName?: string | null
}

interface LocationFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location?: LocationData
}

interface FormState {
  name: string
  ownerName: string
  address: string
  city: string
  state: string
  country: string
  timezone: string
  phone: string
  email: string
}

const defaultFormState: FormState = {
  name: '',
  ownerName: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  timezone: 'Asia/Kolkata',
  phone: '',
  email: '',
}

export function LocationFormSheet({
  open,
  onOpenChange,
  location,
}: LocationFormSheetProps) {
  const queryClient = useQueryClient()
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)

  const isEditMode = !!location

  const [form, setForm] = useState<FormState>(defaultFormState)

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (open) {
      if (location) {
        setForm({
          name: location.name,
          ownerName: location.ownerName ?? '',
          address: location.address ?? '',
          city: location.city ?? '',
          state: location.state ?? '',
          country: location.country,
          timezone: location.timezone,
          phone: location.phone ?? '',
          email: location.email ?? '',
        })
      } else {
        setForm(defaultFormState)
      }
    }
  }, [open, location])

  const createMutation = trpc.location.create.useMutation({
    onSuccess: () => {
      toast.success('Location created successfully')
      queryClient.invalidateQueries({ queryKey: [['location', 'list']] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create location')
    },
  })

  const updateMutation = trpc.location.update.useMutation({
    onSuccess: () => {
      toast.success('Location updated successfully')
      queryClient.invalidateQueries({ queryKey: [['location', 'list']] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update location')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Location name is required')
      return
    }

    if (isEditMode && location) {
      updateMutation.mutate({
        id: location.id,
        name: form.name.trim(),
        ownerName: form.ownerName || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        timezone: form.timezone || undefined,
      })
    } else {
      if (!currentWorkspaceId) {
        toast.error('No workspace selected')
        return
      }

      createMutation.mutate({
        workspaceId: currentWorkspaceId,
        name: form.name.trim(),
        ownerName: form.ownerName || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        timezone: form.timezone || undefined,
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Location' : 'Add Location'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the details of this location.'
              : 'Add a new location to your workspace.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4">
          {/* Name — required */}
          <div className="space-y-2">
            <Label htmlFor="location-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location-name"
              placeholder="e.g. Mumbai HQ"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Store Owner Name */}
          <div className="space-y-2">
            <Label htmlFor="location-owner">Store Owner Name</Label>
            <Input
              id="location-owner"
              placeholder="e.g. Rajesh Kumar"
              value={form.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="location-address">Address</Label>
            <Input
              id="location-address"
              placeholder="123 Business Park, Andheri East"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>

          {/* City — required */}
          <div className="space-y-2">
            <Label htmlFor="location-city">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location-city"
              placeholder="e.g. Mumbai"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              required
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="location-state">State</Label>
            <Input
              id="location-state"
              placeholder="e.g. Maharashtra"
              value={form.state}
              onChange={(e) => updateField('state', e.target.value)}
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="location-country">Country</Label>
            <Input
              id="location-country"
              placeholder="e.g. India"
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
            />
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="location-timezone">Timezone</Label>
            <Input
              id="location-timezone"
              placeholder="e.g. Asia/Kolkata"
              value={form.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="location-phone">Phone</Label>
            <Input
              id="location-phone"
              type="tel"
              placeholder="e.g. +91 22 1234 5678"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="location-email">Email</Label>
            <Input
              id="location-email"
              type="email"
              placeholder="e.g. mumbai@company.com"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? 'Saving...'
                  : 'Creating...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Location'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
