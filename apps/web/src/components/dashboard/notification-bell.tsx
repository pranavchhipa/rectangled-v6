'use client'

import { useState } from 'react'
import {
  Bell,
  Star,
  AlertTriangle,
  Clock,
  Ticket,
  CheckCheck,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const notificationIcons: Record<string, typeof Star> = {
  new_review: Star,
  escalation: AlertTriangle,
  sla_breach: Clock,
  coupon_redeemed: Ticket,
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export function NotificationBell() {
  const { currentWorkspaceId } = useAuthStore()
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()

  const unreadCountQuery = trpc.notification.unreadCount.useQuery(
    { workspaceId: currentWorkspaceId! },
    {
      enabled: !!currentWorkspaceId,
      refetchInterval: 30_000,
    }
  )

  const notificationsQuery = trpc.notification.list.useQuery(
    { workspaceId: currentWorkspaceId!, page: 1, limit: 15 },
    { enabled: !!currentWorkspaceId && open }
  )

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate()
      utils.notification.unreadCount.invalidate()
    },
  })

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate()
      utils.notification.unreadCount.invalidate()
    },
  })

  const unreadCount = (unreadCountQuery.data as any)?.count ?? 0
  const notifications = (notificationsQuery.data as any)?.items ?? []

  function handleMarkRead(notificationId: string) {
    if (!currentWorkspaceId) return
    markReadMutation.mutate({
      workspaceId: currentWorkspaceId,
      notificationId,
    })
  }

  function handleMarkAllRead() {
    if (!currentWorkspaceId) return
    markAllReadMutation.mutate({
      workspaceId: currentWorkspaceId,
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <Separator />

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notificationsQuery.isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            notifications.map((n: any) => {
              const Icon = notificationIcons[n.type] ?? Bell
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) handleMarkRead(n.id)
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-2">
                      {n.title ?? n.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              )
            })
          )}
        </div>

        <Separator />
        <div className="px-4 py-2">
          <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            View all
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
