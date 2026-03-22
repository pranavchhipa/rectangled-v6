'use client'

import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MoreVertical,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
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

// --- Brand SVG Icons ---

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function ZomatoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#E23744"/>
      <path d="M16.5 8.5H8.8l6.2-3.2c.3-.2.7 0 .7.4v1.8c0 .6-.5 1-1.2 1zM7.5 10h7.7L9 13.2c-.3.2-.7 0-.7-.4V11c0-.6.5-1 1.2-1v0zm9 1.5v5c0 .3-.2.5-.5.5H8c-.3 0-.5-.2-.5-.5v-5h9z" fill="white"/>
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)"/>
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="0" fill="none"/>
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#4F46E5"/>
      <path d="M2 7l10 6 10-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="3" fill="#34A853"/>
      <rect x="3" y="4" width="18" height="5" rx="3" fill="#0D652D"/>
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#0D652D"/>
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#0D652D"/>
      <rect x="7" y="12" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="10.5" y="12" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="14" y="12" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="7" y="16" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="10.5" y="16" width="3" height="2.5" rx="0.5" fill="white"/>
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.47 3.44 1.28 4.88L2 22l5.23-1.25A9.93 9.93 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#25D366"/>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.41-1.49-.89-.8-1.49-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.06 4.47.71.31 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" fill="white"/>
    </svg>
  )
}

// --- Brand config per connector ID ---

const CONNECTOR_BRAND: Record<string, {
  icon: React.FC<{ className?: string }>
  borderColor: string
  bgGradient: string
  iconBg: string
  accentColor: string
  buttonClass: string
}> = {
  gbp: {
    icon: GoogleIcon,
    borderColor: 'border-[#4285F4]/30',
    bgGradient: 'bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/20 dark:to-card',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    accentColor: 'text-[#4285F4]',
    buttonClass: 'bg-[#4285F4] hover:bg-[#3367D6] text-white',
  },
  zomato: {
    icon: ZomatoIcon,
    borderColor: 'border-[#E23744]/30',
    bgGradient: 'bg-gradient-to-br from-red-50/80 to-white dark:from-red-950/20 dark:to-card',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    accentColor: 'text-[#E23744]',
    buttonClass: 'bg-[#E23744] hover:bg-[#C62F3B] text-white',
  },
  instagram: {
    icon: InstagramIcon,
    borderColor: 'border-pink-400/30',
    bgGradient: 'bg-gradient-to-br from-pink-50/80 via-purple-50/40 to-orange-50/60 dark:from-pink-950/20 dark:via-purple-950/10 dark:to-card',
    iconBg: 'bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/40 dark:to-purple-900/40',
    accentColor: 'text-pink-600',
    buttonClass: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white',
  },
  email: {
    icon: EmailIcon,
    borderColor: 'border-indigo-400/30',
    bgGradient: 'bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/20 dark:to-card',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    accentColor: 'text-[#4F46E5]',
    buttonClass: 'bg-[#4F46E5] hover:bg-[#4338CA] text-white',
  },
  google_calendar: {
    icon: CalendarIcon,
    borderColor: 'border-[#34A853]/30',
    bgGradient: 'bg-gradient-to-br from-green-50/80 to-white dark:from-green-950/20 dark:to-card',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    accentColor: 'text-[#34A853]',
    buttonClass: 'bg-[#34A853] hover:bg-[#2D9249] text-white',
  },
  wapisnap: {
    icon: WhatsAppIcon,
    borderColor: 'border-[#25D366]/30',
    bgGradient: 'bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-card',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    accentColor: 'text-[#25D366]',
    buttonClass: 'bg-[#25D366] hover:bg-[#1EBE5A] text-white',
  },
}

const DEFAULT_BRAND = {
  icon: GoogleIcon,
  borderColor: 'border-gray-300/50',
  bgGradient: 'bg-gradient-to-br from-gray-50/80 to-white dark:from-gray-900/20 dark:to-card',
  iconBg: 'bg-gray-100 dark:bg-gray-800',
  accentColor: 'text-gray-600',
  buttonClass: 'bg-primary hover:bg-primary/90 text-primary-foreground',
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; dotClass: string; badgeClass: string }
> = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  },
  disconnected: {
    icon: AlertCircle,
    label: 'Disconnected',
    dotClass: 'bg-gray-400',
    badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
}

export function ConnectorCard({
  connectorType,
  instances,
  onConnect,
}: ConnectorCardProps) {
  const queryClient = useQueryClient()
  const brand = CONNECTOR_BRAND[connectorType.id] ?? DEFAULT_BRAND
  const BrandIcon = brand.icon
  const isConnected = instances.length > 0
  const isComingSoon = !connectorType.isActive

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
    <div
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl border-2 shadow-sm
        transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
        ${brand.borderColor} ${brand.bgGradient}
        ${isComingSoon ? 'opacity-70 grayscale-[30%]' : ''}
      `}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${isConnected ? 'bg-emerald-500' : 'bg-transparent'}`} />

      <div className="flex flex-1 flex-col p-6">
        {/* Header: icon + name + status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex size-12 items-center justify-center rounded-xl ${brand.iconBg} p-2.5 shadow-sm`}>
              <BrandIcon className="size-full" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight tracking-tight">
                {connectorType.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {connectorType.bindingLevel === 'location'
                  ? 'Per location'
                  : 'Workspace-wide'}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            {isComingSoon ? (
              <Badge
                variant="secondary"
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium"
              >
                Coming Soon
              </Badge>
            ) : isConnected ? (
              <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">
                <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                {instances.length} Connected
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full px-3 py-1 text-xs text-muted-foreground"
              >
                Not Connected
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {connectorType.description}
        </p>

        {/* Connected instances */}
        {instances.length > 0 && (
          <div className="mt-4 space-y-2">
            {instances.map((instance) => {
              const status =
                STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.disconnected
              const StatusIcon = status.icon

              return (
                <div
                  key={instance.id}
                  className="flex items-center justify-between rounded-xl border bg-white/60 px-3.5 py-2.5 dark:bg-black/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon className="size-4 shrink-0" />
                    <Badge
                      variant="outline"
                      className={`rounded-full text-xs ${status.badgeClass}`}
                    >
                      {status.label}
                    </Badge>
                    {instance.locationId && (
                      <span className="truncate text-xs text-muted-foreground">
                        Location linked
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="size-7">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Settings className="size-4 mr-2" />
                        Manage
                      </DropdownMenuItem>
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action button */}
        <div className="mt-5">
          {isComingSoon ? (
            <Button className="w-full rounded-xl" variant="secondary" disabled>
              Coming Soon
            </Button>
          ) : isConnected ? (
            <Button
              className="w-full rounded-xl"
              variant="outline"
              onClick={() => onConnect(connectorType)}
            >
              Connect Another
            </Button>
          ) : (
            <button
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${brand.buttonClass} shadow-sm hover:shadow-md`}
              onClick={() => onConnect(connectorType)}
            >
              Connect {connectorType.name}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
