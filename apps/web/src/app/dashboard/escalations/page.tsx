'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Clock,
  User,
  Star,
  Search,
  Filter,
  Settings,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'
type EscalationStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'expired'

const PRIORITY_CONFIG: Record<PriorityLevel, { color: string; bgColor: string; borderColor: string; label: string }> = {
  low: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-l-green-500',
    label: 'Low',
  },
  medium: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-l-yellow-500',
    label: 'Medium',
  },
  high: {
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-l-orange-500',
    label: 'High',
  },
  critical: {
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-l-red-500',
    label: 'Critical',
  },
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  open: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200', icon: AlertTriangle, label: 'Open' },
  in_progress: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200', icon: Clock, label: 'In Progress' },
  resolved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200', icon: CheckCircle2, label: 'Resolved' },
  closed: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/60 dark:text-gray-200', icon: XCircle, label: 'Closed' },
  expired: { color: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200', icon: XCircle, label: 'Expired' },
}

function EscalationSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-2 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function EscalationsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedEscalation, setSelectedEscalation] = useState<any | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [noteText, setNoteText] = useState('')

  // Query escalations from cxRouting
  const escalationsQuery = trpc.cxRouting.listEscalations.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      page,
      limit: 20,
    },
    { enabled: !!currentWorkspaceId }
  )

  const membersQuery = trpc.member.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Mutations
  const updateEscalation = trpc.cxRouting.updateEscalation.useMutation({
    onSuccess: () => {
      toast.success('Escalation updated')
      utils.cxRouting.listEscalations.invalidate()
      setSelectedEscalation(null)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update escalation')
    },
  })

  const addNoteMutation = trpc.cxRouting?.addNote?.useMutation?.({
    onSuccess: () => {
      setNoteText('')
      toast.success('Note added')
      escalationsQuery.refetch()
    },
    onError: (err: any) => toast.error(err.message),
  })

  const rawData = (escalationsQuery as any)?.data
  const allEscalations: any[] = Array.isArray(rawData)
    ? rawData
    : (rawData?.data ?? [])

  // Client-side filter for escalated reviews if using fallback
  const escalations = allEscalations.filter((e: any) => {
    if (e.isEscalated === false) return false
    if (statusFilter !== 'all' && e.status && e.status !== statusFilter) return false
    if (priorityFilter !== 'all' && e.priority && e.priority !== priorityFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const text = (e.reviewText ?? e.text ?? e.reviewerName ?? '').toLowerCase()
      if (!text.includes(s)) return false
    }
    return true
  })

  const totalPages = (rawData as any)?.totalPages ?? (Math.ceil(escalations.length / 20) || 1)
  const total = (rawData as any)?.total ?? escalations.length
  const teamMembers = membersQuery.data ?? []

  const handleAssign = () => {
    if (!selectedEscalation || !assignTo) return
    if (updateEscalation) {
      updateEscalation.mutate({
        escalationId: selectedEscalation.id ?? selectedEscalation.escalationId,
        assignedTo: assignTo,
      })
    } else {
      toast.info('Assign feature coming soon')
    }
    setShowAssignDialog(false)
    setAssignTo('')
  }

  const handleUpdateStatus = (escalation: any, newStatus: string) => {
    if (updateEscalation) {
      updateEscalation.mutate({
        escalationId: escalation.id ?? escalation.escalationId,
        status: newStatus,
      })
    } else {
      toast.info('Status update coming soon')
    }
  }

  const statCounts = {
    open: escalations.filter((e: any) => (e.status ?? 'open') === 'open').length,
    in_progress: escalations.filter((e: any) => e.status === 'in_progress').length,
    resolved: escalations.filter((e: any) => e.status === 'resolved').length,
    critical: escalations.filter((e: any) => e.priority === 'critical').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="size-6 text-orange-500" />
            Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage escalated reviews and track resolution progress.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/escalations/rules">
            <Settings className="size-4 mr-1" />
            Escalation Rules
            <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statCounts.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statCounts.in_progress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statCounts.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statCounts.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Priority</span>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search escalations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {/* Content */}
      {escalationsQuery.isLoading ? (
        <EscalationSkeletons />
      ) : escalations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <CheckCircle2 className="size-7 text-green-500" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No escalations</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No escalations match your current filters.'
              : 'All clear! No reviews have been escalated.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {escalations.map((esc: any) => {
              const priority: PriorityLevel = esc.priority ?? 'medium'
              const status: EscalationStatus = esc.status ?? 'open'
              const pc = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium
              const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.open
              const StatusIcon = sc.icon

              return (
                <Card
                  key={esc.id ?? esc.escalationId ?? Math.random()}
                  className={`border-l-4 ${pc.borderColor} hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => setSelectedEscalation(esc)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Priority indicator */}
                      <div className={`flex size-10 items-center justify-center rounded-lg shrink-0 ${pc.bgColor}`}>
                        <AlertTriangle className={`size-5 ${pc.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono font-medium text-muted-foreground">
                            #TKT-{String(esc.ticketNumber ?? 0).padStart(3, '0')}
                          </span>
                          <Badge variant="outline" className={`text-xs ${pc.color}`}>
                            {pc.label} Priority
                          </Badge>
                          <Badge className={`text-xs gap-1 ${sc.color}`}>
                            <StatusIcon className="size-3" />
                            {sc.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {esc.reviewerName && (
                            <span className="text-sm font-medium">{esc.reviewerName}</span>
                          )}
                          {esc.locationName && (
                            <Badge variant="outline" className="text-xs">{esc.locationName}</Badge>
                          )}
                          {(esc.reviewRating ?? esc.rating) != null && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`size-3 ${
                                    i < (esc.reviewRating ?? esc.rating)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-muted-foreground/30'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {esc.reviewText && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {esc.reviewText}
                          </p>
                        )}
                      </div>

                      {/* Assigned to & date */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {esc.assignedToName ?? esc.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="size-6">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {(esc.assignedToName ?? esc.assignedTo ?? 'U')[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {esc.assignedToName ?? esc.assignedTo}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Unassigned
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {esc.reviewedAt
                            ? formatDistanceToNow(new Date(esc.reviewedAt), { addSuffix: true })
                            : esc.createdAt
                              ? formatDistanceToNow(new Date(esc.createdAt), { addSuffix: true })
                              : ''}
                        </span>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEscalation(esc)
                          setShowAssignDialog(true)
                        }}
                      >
                        <Users className="size-3 mr-1" />
                        Assign
                      </Button>
                      {status === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateStatus(esc, 'in_progress')
                          }}
                        >
                          <Clock className="size-3 mr-1" />
                          Start Working
                        </Button>
                      )}
                      {(status === 'open' || status === 'in_progress') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-green-600 hover:bg-green-50 border-green-200 dark:border-green-800"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateStatus(esc, 'resolved')
                          }}
                        >
                          <CheckCircle2 className="size-3 mr-1" />
                          Resolve
                        </Button>
                      )}
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
                Showing {escalations.length} of {total} escalations
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Escalation Detail Sheet */}
      <Sheet
        open={!!selectedEscalation && !showAssignDialog}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEscalation(null)
            setNoteText('')
          }
        }}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedEscalation && (() => {
            const priority: PriorityLevel = selectedEscalation.priority ?? 'medium'
            const status: EscalationStatus = selectedEscalation.status ?? 'open'
            const pc = PRIORITY_CONFIG[priority]
            const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.open

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <AlertTriangle className={`size-5 ${pc.color}`} />
                    Escalation Details
                    <span className="text-xs font-mono font-medium text-muted-foreground ml-1">
                      #TKT-{String(selectedEscalation.ticketNumber ?? 0).padStart(3, '0')}
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`${pc.color}`}>
                      {pc.label} Priority
                    </Badge>
                    <Badge className={`${sc.color}`}>
                      {sc.label}
                    </Badge>
                    {selectedEscalation.locationName && (
                      <Badge variant="outline" className="text-xs">{selectedEscalation.locationName}</Badge>
                    )}
                  </div>

                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {selectedEscalation.reviewerName || 'Anonymous'}
                        </p>
                        {(selectedEscalation.reviewRating ?? selectedEscalation.rating) != null && (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`size-3 ${
                                  i < (selectedEscalation.reviewRating ?? selectedEscalation.rating)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {(selectedEscalation.reviewedAt || selectedEscalation.createdAt) && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(
                            new Date(selectedEscalation.reviewedAt ?? selectedEscalation.createdAt),
                            { addSuffix: true }
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">
                      {selectedEscalation.reviewText ?? selectedEscalation.text ?? 'No review text'}
                    </p>
                  </Card>

                  {selectedEscalation.reason && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Escalation Reason</Label>
                      <p className="text-sm">{selectedEscalation.reason}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    {selectedEscalation.assignedToName ?? selectedEscalation.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(selectedEscalation.assignedToName ?? selectedEscalation.assignedTo ?? 'U')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {selectedEscalation.assignedToName ?? selectedEscalation.assignedTo}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not assigned</p>
                    )}
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      <Users className="size-4 mr-1" />
                      Assign
                    </Button>
                    {status !== 'resolved' && (
                      <Button
                        className="flex-1"
                        onClick={() => handleUpdateStatus(selectedEscalation, 'resolved')}
                      >
                        <CheckCircle2 className="size-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>

                  {/* Activity Log */}
                  <div className="space-y-3 mt-6">
                    <h4 className="text-sm font-semibold">Activity Log</h4>
                    <div className="space-y-2">
                      {((selectedEscalation as any)?.activityLog ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No activity yet.</p>
                      ) : (
                        ((selectedEscalation as any)?.activityLog ?? []).map((entry: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm border-l-2 border-muted pl-3 py-1">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs">{entry.authorName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(entry.timestamp), 'MMM d, HH:mm')}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{entry.text}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Note */}
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!noteText.trim() || !currentWorkspaceId) return
                        addNoteMutation?.mutate?.({
                          workspaceId: currentWorkspaceId,
                          escalationId: selectedEscalation.id,
                          text: noteText.trim(),
                        })
                      }}
                      disabled={!noteText.trim() || addNoteMutation?.isPending}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Escalation</DialogTitle>
            <DialogDescription>
              Choose a team member to handle this escalation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Assign to</Label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member: any) => (
                  <SelectItem key={member.userId ?? member.id} value={member.userId ?? member.id}>
                    {member.userName ?? member.name ?? member.email ?? 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!assignTo}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
