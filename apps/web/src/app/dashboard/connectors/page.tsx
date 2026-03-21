'use client'

import { useState } from 'react'
import { Plug } from 'lucide-react'
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

export default function ConnectorsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const [connectType, setConnectType] = useState<ConnectorType | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

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

  function handleConnect(connectorType: ConnectorType) {
    setConnectType(connectorType)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Connectors</h1>
        <p className="text-sm text-muted-foreground">
          Manage your platform integrations and review sources.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <ConnectorSkeletons />
      ) : types.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Plug className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No connectors available</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Connector types are not configured. Please check your server setup.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Active connectors first, then inactive */}
          {[...types]
            .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
            .map((type) => (
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
