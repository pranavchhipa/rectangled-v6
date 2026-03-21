'use client'

import { useState } from 'react'
import { CalendarDays, Clock, User, MapPin, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
  completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
  cancelled: { color: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
  no_show: { color: 'bg-red-100 text-red-800', label: 'No Show' },
}

export default function AppointmentsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const appointmentsQuery = trpc.appointment?.list?.useQuery?.(
    {
      workspaceId: currentWorkspaceId!,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page,
      limit: 20,
    },
    { enabled: !!currentWorkspaceId }
  )

  const updateStatusMutation = trpc.appointment?.updateStatus?.useMutation?.({
    onSuccess: () => {
      toast.success('Appointment updated')
      appointmentsQuery?.refetch?.()
    },
    onError: (err: any) => toast.error(err.message),
  })

  const cancelMutation = trpc.appointment?.cancel?.useMutation?.({
    onSuccess: () => {
      toast.success('Appointment cancelled')
      appointmentsQuery?.refetch?.()
    },
    onError: (err: any) => toast.error(err.message),
  })

  const rawData = appointmentsQuery?.data
  const appointments = Array.isArray(rawData) ? rawData : (rawData?.data ?? [])
  const totalPages = (rawData as any)?.totalPages ?? 1
  const total = (rawData as any)?.total ?? appointments.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="size-6 text-primary" />
            Appointments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer appointments and scheduling.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Content */}
      {appointmentsQuery?.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <CalendarDays className="size-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">No appointments yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
            Connect Google Calendar to a location to start accepting appointments.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {appointments.map((appt: any) => {
              const sc = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled
              return (
                <Card key={appt.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <CalendarDays className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{appt.title}</span>
                          <Badge className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="size-3.5" />
                            {appt.customerName}
                          </span>
                          {appt.locationName && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              {appt.locationName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {format(new Date(appt.startTime), 'MMM d, yyyy h:mm a')} -
                            {format(new Date(appt.endTime), 'h:mm a')}
                          </span>
                        </div>
                        {appt.customerEmail && (
                          <p className="text-xs text-muted-foreground mt-1">{appt.customerEmail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {appt.status === 'scheduled' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => updateStatusMutation?.mutate?.({
                                workspaceId: currentWorkspaceId!,
                                appointmentId: appt.id,
                                status: 'completed',
                              })}
                            >
                              <CheckCircle2 className="size-3 mr-1" />
                              Complete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-destructive"
                              onClick={() => cancelMutation?.mutate?.({
                                workspaceId: currentWorkspaceId!,
                                appointmentId: appt.id,
                              })}
                            >
                              <XCircle className="size-3 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {appointments.length} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
