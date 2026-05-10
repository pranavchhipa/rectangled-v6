'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Inbox,
  Search,
  Star,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Globe,
  Smartphone,
  Send,
  X,
  Plug,
  CheckCircle2,
  Clock,
  Bot,
  Sparkles,
  Gift,
  Calendar as CalendarIcon,
  User,
  MessageSquare,
  Filter,
  ChevronDown,
  XCircle,
  Phone,
  Loader2,
  Wifi,
  RefreshCw,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DateRangePicker } from '@/components/ui/date-range-picker'

type SourceTab = 'all' | 'gbp' | 'zomato' | 'negative'
type StatusFilter = 'all' | 'responded' | 'pending' | 'escalated'
type RatingFilter = 0 | 1 | 2 | 3 | 4 | 5

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  isLoading: boolean
  color?: string
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600',
    green: 'bg-green-50 dark:bg-green-950/40 text-green-600',
    purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600',
  }
  const c = colorClasses[color ?? 'blue'] ?? colorClasses.blue

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${c}`}>
          <Icon className="size-5" />
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  )
}

function InboxSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ))}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < rating
              ? rating >= 4
                ? 'fill-amber-400 text-amber-400'
                : rating >= 3
                  ? 'fill-orange-400 text-orange-400'
                  : 'fill-red-400 text-red-400'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  )
}

function SourceBadge({ source, platform }: { source: string; platform?: string }) {
  if (source === 'offline') {
    return (
      <Badge variant="secondary" className="gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300">
        <AlertTriangle className="size-3" />
        Negative Feedback
      </Badge>
    )
  }
  const label = platform
    ? platform.charAt(0).toUpperCase() + platform.slice(1)
    : 'Online'
  const colorClass =
    platform === 'google'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
      : platform === 'zomato'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
        : 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
  return (
    <Badge className={`gap-1 text-xs ${colorClass}`} variant="secondary">
      <Globe className="size-3" />
      {label}
    </Badge>
  )
}

function ResponseStatusIcon({ review }: { review: any }) {
  if (review.isEscalated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <AlertTriangle className="size-4 text-red-500" />
          </TooltipTrigger>
          <TooltipContent>Escalated</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  if (review.responseText || review.respondedAt) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <CheckCircle2 className="size-4 text-green-500" />
          </TooltipTrigger>
          <TooltipContent>Responded</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Clock className="size-4 text-orange-500" />
        </TooltipTrigger>
        <TooltipContent>Pending response</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function InboxPage() {
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()

  const [sourceTab, setSourceTab] = useState<SourceTab>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(0)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedReview, setSelectedReview] = useState<any | null>(null)
  const [responseText, setResponseText] = useState('')
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null)
  const [showCouponDialog, setShowCouponDialog] = useState(false)
  const [couponTargetReview, setCouponTargetReview] = useState<any | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')

  const utils = trpc.useUtils()

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )
  const locations = locationsQuery.data ?? []

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const statsQuery = trpc.review.stats.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Map sourceTab to API filter
  const isNegativeTab = sourceTab === 'negative'
  const sourceFilter = sourceTab === 'all' || isNegativeTab ? undefined
    : 'online' as const

  const platformFilter = sourceTab === 'gbp' ? 'google'
    : sourceTab === 'zomato' ? 'zomato'
    : undefined

  const reviewsQuery = trpc.review.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      locationId: selectedLocationId !== 'all' ? selectedLocationId : undefined,
      source: isNegativeTab ? 'offline' as const : sourceFilter,
      search: debouncedSearch || undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      page,
      limit: 20,
    },
    { enabled: !!currentWorkspaceId }
  )

  const respondMutation = trpc.review.respond.useMutation({
    onSuccess: () => {
      toast.success('Response sent successfully')
      setResponseText('')
      setSelectedReview(null)
      utils.review.list.invalidate()
      utils.review.stats.invalidate()
    },
    onError: (error) => {
      // Log the full error so it shows up in DevTools Console / monitoring.
      // Several real-world failure modes (expired GBP token, missing
      // gbpResourceName, FORBIDDEN role) bubble up here — surface the
      // shape/cause to the user instead of swallowing it.
      // eslint-disable-next-line no-console
      console.error('[Inbox] review.respond failed', error)
      const code = (error as any)?.data?.code ?? (error as any)?.shape?.data?.code
      const friendly =
        code === 'FORBIDDEN'
          ? "You don't have permission to reply to reviews."
          : code === 'PRECONDITION_FAILED'
            ? error.message ||
              'Cannot reply: the connector is missing credentials. Reconnect Google Business Profile.'
            : code === 'NOT_FOUND'
              ? 'Review not found. Refresh the page and try again.'
              : error.message || 'Failed to send response'
      toast.error(friendly)
    },
  })

  // AI Generate response
  const generateMutation = trpc.aiResponse.generateResponse.useMutation({
    onSuccess: (data) => {
      setResponseText(data.generatedText)
      toast.success('AI response generated')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate AI response')
    },
  })

  // Sync all reviews
  const syncAllMutation = trpc.review.syncAll.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data?.synced ?? 0} new reviews`)
      utils.review.list.invalidate()
      utils.review.stats.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync reviews')
    },
  })

  // Schedule response
  const scheduleMutation = trpc.aiResponse.schedule.useMutation({
    onSuccess: () => {
      toast.success('Response scheduled successfully')
      setShowScheduleDialog(false)
      setScheduleDate('')
      setScheduleTime('')
      setSelectedReview(null)
      utils.review.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to schedule response')
    },
  })

  // Escalate
  const escalateMutation = trpc.review.escalate?.useMutation?.({
    onSuccess: () => {
      toast.success('Review escalated')
      utils.review.list.invalidate()
      utils.review.stats.invalidate()
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to escalate review')
    },
  }) ?? null

  // Coupon WhatsApp preflight check
  const preflightQuery = trpc.coupon.preflightWhatsApp.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      customerId: couponTargetReview?.customerId ?? undefined,
      locationId: couponTargetReview?.locationId ?? undefined,
    },
    { enabled: !!currentWorkspaceId && showCouponDialog && !!couponTargetReview }
  )

  const sendCouponMutation = trpc.coupon.sendViaWhatsApp.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'Coupon sent via WhatsApp!')
        setShowCouponDialog(false)
        setCouponTargetReview(null)
      } else {
        toast.error(data.message || 'Failed to send coupon')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send coupon')
    },
  })

  const handleSendCoupon = (review: any) => {
    setCouponTargetReview(review)
    setShowCouponDialog(true)
  }

  const handleSendCouponViaWhatsApp = (templateId: string) => {
    if (!couponTargetReview || !currentWorkspaceId) return
    sendCouponMutation.mutate({
      workspaceId: currentWorkspaceId,
      templateId,
      customerId: couponTargetReview.customerId ?? undefined,
      locationId: couponTargetReview.locationId ?? undefined,
      reviewId: couponTargetReview.id,
    })
  }

  const allReviews = reviewsQuery.data?.data ?? []

  // Client-side filters for rating, status, platform, and date range
  const reviews = allReviews.filter((r: any) => {
    // Rating filter
    if (ratingFilter > 0 && r.rating !== ratingFilter) return false
    // Platform filter
    if (platformFilter && r.platform !== platformFilter) return false
    // Status filter
    if (statusFilter === 'responded' && !r.responseText && !r.respondedAt) return false
    if (statusFilter === 'pending' && (r.responseText || r.respondedAt)) return false
    if (statusFilter === 'escalated' && !r.isEscalated) return false
    return true
  })

  const totalPages = reviewsQuery.data?.totalPages ?? 0
  const total = reviewsQuery.data?.total ?? 0

  const stats = statsQuery.data
  const totalReviews = (stats as any)?.totalReviews ?? 0
  const onlineCount = (stats as any)?.onlineCount ?? 0
  const offlineCount = (stats as any)?.offlineCount ?? 0
  const avgRating = (stats as any)?.averageRating ?? 0
  const pendingCount = (stats as any)?.pendingCount ?? allReviews.filter((r: any) => !r.responseText && !r.respondedAt).length

  const sourceTabs: { label: string; value: SourceTab }[] = [
    { label: 'All', value: 'all' },
    { label: 'GBP', value: 'gbp' },
    { label: 'Zomato', value: 'zomato' },
    { label: 'Negative Feedbacks', value: 'negative' },
  ]

  const ratingButtons: { label: string; value: RatingFilter }[] = [
    { label: 'All', value: 0 },
    { label: '5\u2605', value: 5 },
    { label: '4\u2605', value: 4 },
    { label: '3\u2605', value: 3 },
    { label: '2\u2605', value: 2 },
    { label: '1\u2605', value: 1 },
  ]

  const handleGenerateAI = (reviewId: string) => {
    generateMutation.mutate({ reviewId })
  }

  const handleEscalate = (reviewId: string) => {
    if (escalateMutation) {
      escalateMutation.mutate({ reviewId })
    } else {
      toast.info('Escalation feature coming soon')
    }
  }

  const handleScheduleSubmit = () => {
    if (!selectedReview || !scheduleDate || !scheduleTime || !responseText.trim()) {
      toast.error('Please fill in all schedule fields and generate a response first')
      return
    }
    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`)
    if (scheduledFor <= new Date()) {
      toast.error('Scheduled time must be in the future')
      return
    }
    scheduleMutation.mutate({
      reviewId: selectedReview.id,
      scheduledFor,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and respond to customer reviews from all channels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedLocationId} onValueChange={(val) => { setSelectedLocationId(val); setPage(1) }}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}{loc.city ? ` — ${loc.city}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => currentWorkspaceId && syncAllMutation.mutate({ workspaceId: currentWorkspaceId })}
            disabled={syncAllMutation.isPending}
          >
            <RefreshCw className={`size-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
            {syncAllMutation.isPending ? 'Syncing...' : 'Sync Reviews'}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Reviews"
          value={totalReviews}
          icon={Inbox}
          isLoading={statsQuery.isLoading}
          color="blue"
        />
        <StatCard
          label="Avg. Rating"
          value={avgRating ? Number(avgRating).toFixed(1) : '\u2014'}
          icon={Star}
          isLoading={statsQuery.isLoading}
          color="amber"
        />
        <StatCard
          label="Response Rate"
          value={totalReviews > 0 ? `${Math.round(((totalReviews - pendingCount) / totalReviews) * 100)}%` : '\u2014'}
          icon={MessageSquare}
          isLoading={statsQuery.isLoading}
          color="green"
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          icon={Clock}
          isLoading={statsQuery.isLoading}
          color="purple"
        />
      </div>

      {/* Filter Bar */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source dropdown */}
          <Select value={sourceTab} onValueChange={(val) => { setSourceTab(val as SourceTab); setPage(1) }}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <Globe className="size-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {sourceTabs.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status dropdown */}
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val as StatusFilter); setPage(1) }}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <CheckCircle2 className="size-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
            </SelectContent>
          </Select>

          {/* Rating dropdown */}
          <Select value={String(ratingFilter)} onValueChange={(val) => { setRatingFilter(Number(val) as RatingFilter); setPage(1) }}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <Star className="size-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              {ratingButtons.map((rb) => (
                <SelectItem key={rb.value} value={String(rb.value)}>{rb.label === 'All' ? 'All Ratings' : rb.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={(range) => {
              setDateRange(range)
              setPage(1)
            }}
            presets={['today', '7d', '14d', '30d', '90d', 'all']}
          />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reviews by name, text, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </Card>

      {/* Content */}
      {reviewsQuery.isLoading ? (
        <InboxSkeletons />
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No reviews found</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {sourceTab !== 'all' || statusFilter !== 'all' || ratingFilter > 0
              ? 'No reviews match your current filters. Try adjusting the filters above.'
              : 'Connect a review platform and sync your reviews to get started.'}
          </p>
          {sourceTab === 'all' && statusFilter === 'all' && ratingFilter === 0 && (
            <Button
              className="mt-6"
              onClick={() => router.push('/dashboard/connectors')}
            >
              <Plug className="size-4" />
              Connect a Platform
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reviews.map((review: any) => {
              const isExpanded = expandedReviewId === review.id
              const reviewTextFull = review.reviewText ?? review.text ?? ''
              const isLong = reviewTextFull.length > 200

              return (
                <Card
                  key={review.id}
                  className="overflow-hidden transition-all hover:shadow-md"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setSelectedReview(review)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Left: Rating + Source */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                        <StarRating rating={review.rating ?? 0} />
                        <SourceBadge
                          source={review.source ?? 'online'}
                          platform={review.platform}
                        />
                      </div>

                      {/* Center: Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold truncate">
                            {review.reviewerName || 'Anonymous'}
                          </span>
                          {review.isEscalated && (
                            <Badge variant="destructive" className="gap-1 text-[10px] px-1.5">
                              <AlertTriangle className="size-2.5" />
                              Escalated
                            </Badge>
                          )}
                          {review.locationName && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {review.locationName}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {review.reviewedAt ? formatDistanceToNow(new Date(review.reviewedAt), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        <p className={`text-sm text-muted-foreground ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {reviewTextFull}
                        </p>
                        {isLong && (
                          <button
                            className="text-xs text-primary hover:underline mt-0.5"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedReviewId(isExpanded ? null : review.id)
                            }}
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                        {review.aspectTags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {review.aspectTags.map((tag: string) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Date + Status */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {review.reviewedAt
                            ? format(new Date(review.reviewedAt), 'dd MMM yyyy')
                            : ''}
                        </span>
                        <ResponseStatusIcon review={review} />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center gap-2 px-4 pb-3 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedReview(review)
                        handleGenerateAI(review.id)
                      }}
                      disabled={generateMutation.isPending}
                    >
                      <Sparkles className="size-3" />
                      {review.responseText || review.respondedAt ? 'Re-reply with AI' : 'AI Generate'}
                    </Button>
                    {!review.isEscalated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEscalate(review.id)
                        }}
                      >
                        <AlertTriangle className="size-3" />
                        Escalate
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSendCoupon(review)
                      }}
                    >
                      <Gift className="size-3" />
                      Send Coupon
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}&ndash;
                {Math.min(page * 20, total)} of {total}
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

      {/* Review detail sheet */}
      <Sheet
        open={!!selectedReview}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReview(null)
            setResponseText('')
          }
        }}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedReview && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Review Details
                  {selectedReview.isEscalated && (
                    <Badge variant="destructive" className="text-xs">
                      Escalated
                    </Badge>
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge
                    source={selectedReview.source ?? 'online'}
                    platform={selectedReview.platform}
                  />
                  <StarRating rating={selectedReview.rating ?? 0} />
                  <span className="text-xs text-muted-foreground">
                    {selectedReview.reviewedAt
                      ? format(new Date(selectedReview.reviewedAt), 'dd MMM yyyy')
                      : ''}
                  </span>
                </div>

                {/* Customer profile card */}
                <Card className="p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedReview.reviewerName || 'Anonymous Customer'}
                      </p>
                      {selectedReview.reviewerEmail && (
                        <p className="text-xs text-muted-foreground">
                          {selectedReview.reviewerEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Review text */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Review</Label>
                  <p className="text-sm leading-relaxed">
                    {selectedReview.reviewText ?? selectedReview.text ?? ''}
                  </p>
                </div>

                {/* Aspect tags */}
                {selectedReview.aspectTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReview.aspectTags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Existing response */}
                {(selectedReview.responseText || selectedReview.respondedAt) && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-green-500" />
                      Previous Response
                    </Label>
                    <Card className="p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                      <p className="text-sm">
                        {selectedReview.responseText || 'Response sent'}
                      </p>
                      {selectedReview.respondedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Responded on {new Date(selectedReview.respondedAt).toLocaleDateString()}
                        </p>
                      )}
                    </Card>
                  </div>
                )}

                {/* Response area */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Reply</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleGenerateAI(selectedReview.id)}
                      disabled={generateMutation.isPending}
                    >
                      <Sparkles className="size-3" />
                      {generateMutation.isPending ? 'Generating...' : 'AI Suggest'}
                    </Button>
                  </div>

                  {/* AI suggestion indicator */}
                  {responseText && generateMutation.isSuccess && (
                    <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 rounded-md px-3 py-1.5">
                      <Bot className="size-3" />
                      AI-generated suggestion. Edit as needed before sending.
                    </div>
                  )}

                  <textarea
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Write your response..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const reviewId = selectedReview?.id
                        const trimmed = responseText.trim()
                        // eslint-disable-next-line no-console
                        console.log('[Inbox] Send Now clicked', {
                          reviewId,
                          trimmedLength: trimmed.length,
                        })
                        if (!reviewId) {
                          toast.error(
                            'No review selected. Close this panel and click a review again.',
                          )
                          return
                        }
                        if (!trimmed) {
                          toast.error('Reply cannot be empty.')
                          return
                        }
                        respondMutation.mutate({
                          reviewId,
                          responseText: trimmed,
                        })
                      }}
                      disabled={!responseText.trim() || respondMutation.isPending}
                      className="flex-1"
                    >
                      <Send className="size-4" />
                      {respondMutation.isPending ? 'Sending...' : 'Send Now'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowScheduleDialog(true)}
                      disabled={!responseText.trim()}
                    >
                      <CalendarIcon className="size-4" />
                      Schedule
                    </Button>
                  </div>
                </div>

                {/* Escalation actions */}
                {!selectedReview.isEscalated && (
                  <>
                    <Separator />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950/30"
                        onClick={() => handleEscalate(selectedReview.id)}
                      >
                        <AlertTriangle className="size-4" />
                        Escalate Review
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/30"
                        onClick={() => handleSendCoupon(selectedReview)}
                      >
                        <Gift className="size-4" />
                        Send Coupon
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule AI Response</DialogTitle>
            <DialogDescription>
              Choose a date and time to automatically post this response.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSubmit}
              disabled={!scheduleDate || !scheduleTime || scheduleMutation.isPending}
            >
              <CalendarIcon className="size-4" />
              {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Coupon via WhatsApp Dialog */}
      <Dialog
        open={showCouponDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCouponDialog(false)
            setCouponTargetReview(null)
            sendCouponMutation.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="size-5 text-purple-500" />
              Send Coupon via WhatsApp
            </DialogTitle>
            <DialogDescription>
              {couponTargetReview?.reviewerName
                ? `Send a coupon to ${couponTargetReview.reviewerName} via WhatsApp.`
                : 'Send a coupon to this customer via WhatsApp.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Preflight checks */}
            {preflightQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ))}
              </div>
            ) : preflightQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <XCircle className="size-8 text-red-500 mb-2" />
                <p className="text-sm font-medium text-red-600">Failed to run pre-flight checks</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preflightQuery.error?.message || 'An unexpected error occurred.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => preflightQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : preflightQuery.data ? (
              <>
                {/* Step 1: Customer Phone */}
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  preflightQuery.data.customerPhone.ok
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                }`}>
                  <div className="mt-0.5">
                    {preflightQuery.data.customerPhone.ok ? (
                      <CheckCircle2 className="size-5 text-green-500" />
                    ) : (
                      <XCircle className="size-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      Customer Phone Number
                    </p>
                    {preflightQuery.data.customerPhone.ok ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {preflightQuery.data.customerPhone.customerName} &mdash; {preflightQuery.data.customerPhone.phone}
                      </p>
                    ) : (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        {preflightQuery.data.customerPhone.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 2: WapiSnap connection */}
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  preflightQuery.data.wapisnap.ok
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                }`}>
                  <div className="mt-0.5">
                    {preflightQuery.data.wapisnap.ok ? (
                      <CheckCircle2 className="size-5 text-green-500" />
                    ) : (
                      <XCircle className="size-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Wifi className="size-3.5" />
                      WhatsApp (WapiSnap) Connection
                    </p>
                    {preflightQuery.data.wapisnap.ok ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        WhatsApp is connected and ready.
                      </p>
                    ) : (
                      <div>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          {preflightQuery.data.wapisnap.message}
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs mt-1"
                          onClick={() => {
                            setShowCouponDialog(false)
                            router.push('/dashboard/connectors')
                          }}
                        >
                          Go to Connectors
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Coupon Templates */}
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  preflightQuery.data.templates.ok
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                }`}>
                  <div className="mt-0.5">
                    {preflightQuery.data.templates.ok ? (
                      <CheckCircle2 className="size-5 text-green-500" />
                    ) : (
                      <XCircle className="size-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Gift className="size-3.5" />
                      Coupon Templates
                    </p>
                    {preflightQuery.data.templates.ok ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {preflightQuery.data.templates.templates.length} active template{preflightQuery.data.templates.templates.length !== 1 ? 's' : ''} available.
                      </p>
                    ) : (
                      <div>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          {preflightQuery.data.templates.message}
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs mt-1"
                          onClick={() => {
                            setShowCouponDialog(false)
                            router.push('/dashboard/coupons')
                          }}
                        >
                          Go to Coupons
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Template selector - only show if all checks pass */}
                {preflightQuery.data.customerPhone.ok &&
                  preflightQuery.data.wapisnap.ok &&
                  preflightQuery.data.templates.ok && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Select a coupon template to send</Label>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {preflightQuery.data.templates.templates.map((template) => (
                          <Card
                            key={template.id}
                            className={`p-3 cursor-pointer transition-all hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 ${
                              sendCouponMutation.isPending ? 'pointer-events-none opacity-60' : ''
                            }`}
                            onClick={() => handleSendCouponViaWhatsApp(template.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{template.name}</p>
                                {template.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {template.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <Badge variant="secondary" className="text-xs">
                                    {template.discountType === 'percentage'
                                      ? `${template.discountValue}% off`
                                      : template.discountType === 'flat'
                                        ? `₹${template.discountValue} off`
                                        : 'Freebie'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Valid {template.validityDays} days
                                  </span>
                                </div>
                              </div>
                              <Send className="size-4 text-purple-500 shrink-0 mt-1" />
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Sending state */}
                {sendCouponMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Sending coupon via WhatsApp...
                  </div>
                )}

                {/* Send result error */}
                {sendCouponMutation.isSuccess && !sendCouponMutation.data?.success && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                    <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to send</p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                        {sendCouponMutation.data?.message}
                      </p>
                      {sendCouponMutation.data?.couponCode && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Coupon code <strong>{sendCouponMutation.data.couponCode}</strong> was issued but delivery failed. You can resend manually.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCouponDialog(false)
                setCouponTargetReview(null)
                sendCouponMutation.reset()
              }}
            >
              {sendCouponMutation.isSuccess && sendCouponMutation.data?.success ? 'Done' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
