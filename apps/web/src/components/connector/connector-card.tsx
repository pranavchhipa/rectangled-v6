'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Globe,
  Utensils,
  MessageCircle,
  Mail,
  MoreVertical,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ConnectorType {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  authType: string
  bindingLevel: string
  isActive: boolean
}

interface ConnectorInstance {
  id: string
  connectorTypeId: string
  workspaceId: string
  locationId: string | null
  status: string
  config: unknown
  errorMessage: string | null
  createdAt: string
  connectorType: ConnectorType | null
}

interface ConnectorCardProps {
  connectorType: ConnectorType
  instances: ConnectorInstance[]
  onConnect: (connectorType: ConnectorType) => void
}

const CONNECTOR_ICONS: Record<string, React.ElementType> = {
  gbp: Globe,
  zomato: Utensils,
  wapisnap: MessageCircle,
  email: Mail,
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; className: string }
> = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    className: 'bg-emerald-100 text-emerald-700',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    className: 'bg-red-100 text-red-700',
  },
  disconnected: {
    icon: AlertCircle,
    label: 'Disconnected',
    className: 'bg-gray-100 text-gray-600',
  },
}

export function ConnectorCard({
  connectorType,
  instances,
  onConnect,
}: ConnectorCardProps) {
  const queryClient = useQueryClient()
  const Icon = CONNECTOR_ICONS[connectorType.id] ?? Globe

  const disconnectMutation = trpc.connector.disconnect.useMutation({
    onSuccess: () => {
      toast.success(`${connectorType.name} disconnected`)
      queryClient.invalidateQueries({
        queryKey: [['connector', 'listInstances']],
      })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to disconnect')
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{connectorType.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {connectorType.bindingLevel === 'location'
                ? 'Per location'
                : 'Per workspace'}
            </p>
          </div>
        </div>
        <CardAction>
          {!connectorType.isActive ? (
            <Badge variant="secondary">Coming soon</Badge>
          ) : instances.length > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {instances.length} connected
            </Badge>
          ) : null}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {connectorType.description}
        </p>

        {/* Connected instances */}
        {instances.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {instances.map((instance) => {
              const status =
                STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.disconnected
              const StatusIcon = status.icon

              return (
                <div
                  key={instance.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon className="size-4 shrink-0" />
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          disconnectMutation.mutate({
                            instanceId: instance.id,
                          })
                        }
                        disabled={disconnectMutation.isPending}
                      >
                        <Trash2 className="size-4 mr-2" />
                        Disconnect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        )}

        {/* Connect button */}
        {connectorType.isActive && (
          <Button
            className="w-full"
            variant={instances.length > 0 ? 'outline' : 'default'}
            onClick={() => onConnect(connectorType)}
          >
            {instances.length > 0
              ? 'Connect Another'
              : `Connect ${connectorType.name}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
