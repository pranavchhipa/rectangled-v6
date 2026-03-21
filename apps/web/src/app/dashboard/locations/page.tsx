'use client'

import { useMemo, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LocationCard } from '@/components/location/location-card'
import { LocationFormSheet } from '@/components/location/location-form-sheet'

function LocationSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <MapPin className="size-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No locations yet</h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        Locations represent your business branches or outlets. Add your first
        location to start managing reviews and reputation.
      </p>
      <Button className="mt-6" onClick={onAdd}>
        <Plus className="size-4" />
        Add Your First Location
      </Button>
    </div>
  )
}

export default function LocationsPage() {
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  const [sheetOpen, setSheetOpen] = useState(false)

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const connectorsQuery = trpc.connector.listInstances.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Build location-to-platform mapping
  const locationPlatforms = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const conn of (connectorsQuery.data ?? []) as any[]) {
      const locId = conn.locationId
      if (locId) {
        if (!map[locId]) map[locId] = []
        map[locId].push(conn.connectorTypeId)
      }
    }
    return map
  }, [connectorsQuery.data])

  const locations = locationsQuery.data ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage the branches and outlets in your workspace.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          Add Location
        </Button>
      </div>

      {/* Content */}
      {locationsQuery.isLoading ? (
        <LocationSkeletons />
      ) : locationsQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load locations. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => locationsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : locations.length === 0 ? (
        <EmptyState onAdd={() => setSheetOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={{
                ...location,
                connectedPlatforms: locationPlatforms[location.id] ?? [],
              }}
            />
          ))}
        </div>
      )}

      {/* Create sheet */}
      <LocationFormSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
