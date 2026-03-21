'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MapPin, Phone, Mail, Pencil, Trash2, User } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { PlatformIconRow } from '@/components/ui/platform-icons'
import { LocationFormSheet } from './location-form-sheet'

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
  connectedPlatforms?: string[]
}

interface LocationCardProps {
  location: LocationData
}

export function LocationCard({ location }: LocationCardProps) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const toggleMutation = trpc.location.toggleActive.useMutation({
    onSuccess: () => {
      toast.success(
        location.isActive ? 'Location deactivated' : 'Location activated'
      )
      queryClient.invalidateQueries({ queryKey: [['location', 'list']] })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to toggle location status')
    },
  })

  const deleteMutation = trpc.location.delete.useMutation({
    onSuccess: () => {
      toast.success('Location deleted')
      queryClient.invalidateQueries({ queryKey: [['location', 'list']] })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete location')
    },
  })

  function handleToggleActive() {
    toggleMutation.mutate({ id: location.id })
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    deleteMutation.mutate({ id: location.id })
    setDeleteConfirm(false)
  }

  // Build the city/state display string
  const cityState = [location.city, location.state]
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <Card className="relative">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {location.name}
          </CardTitle>
          <CardAction>
            <Badge
              variant={location.isActive ? 'default' : 'secondary'}
              className={
                location.isActive
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  : ''
              }
            >
              {location.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* City & State */}
          {cityState && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              <span>{cityState}</span>
            </div>
          )}

          {/* Phone */}
          {location.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-4 shrink-0" />
              <span>{location.phone}</span>
            </div>
          )}

          {/* Email */}
          {location.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4 shrink-0" />
              <span>{location.email}</span>
            </div>
          )}

          {/* Owner */}
          {location.ownerName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="size-4 shrink-0" />
              <span>{location.ownerName}</span>
            </div>
          )}

          {/* Connected platforms */}
          <div className="flex items-center gap-2 text-sm">
            <PlatformIconRow platforms={location.connectedPlatforms ?? []} />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={location.isActive}
                onCheckedChange={handleToggleActive}
                disabled={toggleMutation.isPending}
                size="sm"
                aria-label="Toggle active state"
              />
              <span className="text-xs text-muted-foreground">
                {location.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditOpen(true)}
                aria-label="Edit location"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant={deleteConfirm ? 'destructive' : 'ghost'}
                size={deleteConfirm ? 'sm' : 'icon-sm'}
                onClick={handleDelete}
                onBlur={() => setDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
                aria-label={deleteConfirm ? 'Confirm delete' : 'Delete location'}
              >
                {deleteConfirm ? (
                  'Confirm?'
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LocationFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        location={location}
      />
    </>
  )
}
