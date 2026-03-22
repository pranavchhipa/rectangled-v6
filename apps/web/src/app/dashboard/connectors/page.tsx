'use client'

import { useState } from 'react'
import { Plug, Search } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectorCard } from '@/components/connector/connector-card'
import { ConnectorConnectSheet } from '@/components/connector/connector-connect-sheet'

interface ConnectorType {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  authType: string
  bindingLevel: string
  isActive: boolean
}

function ConnectorSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-2xl border-2 bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-xl" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export default function ConnectorsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const [connectType, setConnectType] = useState<ConnectorType | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const typesQuery = trpc.connector.listTypes.useQuery()
  const instancesQuery = trpc.connector.listInstances.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const types = typesQuery.data ?? []
  const instances = instancesQuery.data ?? []
  const isLoading = typesQuery.isLoading || instancesQuery.isLoading

  // Group instances by connector type
  const instancesByType = new Map<string, typeof instances>()
  for (const inst of instances) {
    const key = inst.connectorTypeId ?? ''
    const arr = instancesByType.get(key) ?? []
    arr.push(inst)
    instancesByType.set(key, arr)
  }

  // Filter types by search
  const filteredTypes = types.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort: active first, then by connection count, then alphabetically
  const sortedTypes = [...filteredTypes].sort((a, b) => {
    const aActive = a.isActive ? 1 : 0
    const bActive = b.isActive ? 1 : 0
    if (aActive !== bActive) return bActive - aActive
    const aConns = (instancesByType.get(a.id) ?? []).length
    const bConns = (instancesByType.get(b.id) ?? []).length
    if (aConns !== bConns) return bConns - aConns
    return a.name.localeCompare(b.name)
  })

  const connectedCount = types.filter(
    (t) => (instancesByType.get(t.id) ?? []).length > 0
  ).length

  function handleConnect(connectorType: ConnectorType) {
    setConnectType(connectorType)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your platforms and tools to manage everything from one place.
            {!isLoading && types.length > 0 && (
              <span className="ml-1">
                <span className="font-medium text-foreground">{connectedCount}</span> of{' '}
                <span className="font-medium text-foreground">{types.filter((t) => t.isActive).length}</span>{' '}
                connected.
              </span>
            )}
          </p>
        </div>

        {/* Search */}
        {!isLoading && types.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <ConnectorSkeletons />
      ) : types.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Plug className="size-8 text-muted-foreground" />
          </div>
          <h3 className="mt-5 text-lg font-semibold">No connectors available</h3>
          <p className="mt-1.5 max-w-sm text-center text-sm text-muted-foreground">
            Connector types are not configured. Please check your server setup.
          </p>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 py-16">
          <Search className="size-8 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No matching connectors</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTypes.map((type) => (
            <ConnectorCard
              key={type.id}
              connectorType={type}
              instances={instancesByType.get(type.id) ?? []}
              onConnect={handleConnect}
            />
          ))}
        </div>
      )}

      {/* Connect sheet */}
      <ConnectorConnectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        connectorType={connectType}
      />
    </div>
  )
}
