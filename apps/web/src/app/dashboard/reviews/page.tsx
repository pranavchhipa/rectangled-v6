'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, RefreshCw, Plug, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ReviewStatsBar } from '@/components/review/review-stats-bar'
import { ReviewFilters } from '@/components/review/review-filters'
import { ReviewTable } from '@/components/review/review-table'
import { ReviewDetailSheet } from '@/components/review/review-detail-sheet'
import { BulkActionBar } from '@/components/review/bulk-action-bar'

function ReviewSkeletons() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-4 rounded" />
          <div className="flex items-center gap-2.5 min-w-[200px]">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()

  // Filters
  const [platform, setPlatform] = useState('all')
  const [minRating, setMinRating] = useState<number | undefined>(undefined)
  const [sentiment, setSentiment] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Selected review for detail sheet
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const utils = trpc.useUtils()

  const bulkGenerateMutation = trpc.review.bulkGenerateResponses.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Generated ${data.succeeded} of ${data.total} responses` +
          (data.failed > 0 ? ` (${data.failed} failed)` : '')
      )
      setSelectedIds(new Set())
      utils.review.list.invalidate()
      utils.review.stats.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate responses')
    },
  })

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      const timer = setTimeout(() => {
        setDebouncedSearch(value)
        setPage(1)
      }, 300)
      return () => clearTimeout(timer)
    },
    []
  )

  // Stats query
  const statsQuery = trpc.review.stats.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Reviews list query
  const reviewsQuery = trpc.review.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      platform: platform !== 'all' ? platform : undefined,
      minRating,
      sentiment:
        sentiment !== 'all'
          ? (sentiment as 'positive' | 'negative' | 'neutral' | 'mixed')
          : undefined,
      search: debouncedSearch || undefined,
      page,
      limit: 20,
    },
    { enabled: !!currentWorkspaceId }
  )

  const reviews = reviewsQuery.data?.data ?? []
  const totalPages = reviewsQuery.data?.totalPages ?? 0
  const total = reviewsQuery.data?.total ?? 0

  // Reviews eligible for bulk selection (no existing response)
  const selectableReviews = reviews.filter(
    (r) => !(r as any).latestResponse
  )

  const allSelectableChecked =
    selectableReviews.length > 0 &&
    selectableReviews.every((r) => selectedIds.has(r.id))

  const someSelectableChecked =
    selectableReviews.some((r) => selectedIds.has(r.id)) &&
    !allSelectableChecked

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelectableChecked) {
        // Deselect all on this page
        selectableReviews.forEach((r) => next.delete(r.id))
      } else {
        // Select all on this page
        selectableReviews.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectableReviews.length > 0 && (
            <Checkbox
              checked={allSelectableChecked ? true : someSelectableChecked ? 'indeterminate' : false}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all reviews on page"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">Reviews</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and respond to customer reviews across platforms.
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <ReviewStatsBar
        stats={statsQuery.data}
        isLoading={statsQuery.isLoading}
      />

      {/* Filters */}
      <ReviewFilters
        platform={platform}
        onPlatformChange={(v) => {
          setPlatform(v)
          setPage(1)
        }}
        minRating={minRating}
        onMinRatingChange={(v) => {
          setMinRating(v)
          setPage(1)
        }}
        sentiment={sentiment}
        onSentimentChange={(v) => {
          setSentiment(v)
          setPage(1)
        }}
        search={search}
        onSearchChange={handleSearchChange}
      />

      {/* Content */}
      {reviewsQuery.isLoading ? (
        <ReviewSkeletons />
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No reviews yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Connect a review platform and sync your reviews to get started.
          </p>
          <Button
            className="mt-6"
            onClick={() => router.push('/dashboard/connectors')}
          >
            <Plug className="size-4" />
            Connect a Platform
          </Button>
        </div>
      ) : (
        <>
          {/* Review table */}
          <ReviewTable
            reviews={reviews as any}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectOne}
            onRowClick={(id) => setSelectedReviewId(id)}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}–
                {Math.min(page * 20, total)} of {total} reviews
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

      {/* Detail sheet */}
      <ReviewDetailSheet
        reviewId={selectedReviewId}
        open={!!selectedReviewId}
        onOpenChange={(open) => {
          if (!open) setSelectedReviewId(null)
        }}
      />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onGenerateResponses={() =>
            bulkGenerateMutation.mutate({ reviewIds: Array.from(selectedIds) })
          }
          onClearSelection={() => setSelectedIds(new Set())}
          isGenerating={bulkGenerateMutation.isPending}
        />
      )}
    </div>
  )
}
