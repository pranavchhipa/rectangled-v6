'use client'

import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Globe, Smartphone, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StarRating } from './star-rating'

interface ReviewResponse {
  id: string
  status: string
  generatedBy: string
}

/**
 * Canonical review row shape. Inbox supplies extra optional fields
 * (locationName, isEscalated, source) — they render only when the
 * matching `show*` prop is true.
 */
export interface ReviewRow {
  id: string
  platform: string
  platformReviewId?: string
  reviewerName: string | null
  rating: number
  text?: string | null
  reviewText?: string | null
  reviewedAt: string
  sentiment?: string | null
  latestResponse?: ReviewResponse | null
  // Inbox-only optional metadata
  locationName?: string | null
  isEscalated?: boolean
  source?: 'online' | 'offline' | string
}

interface ReviewTableProps {
  reviews: ReviewRow[]
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onRowClick: (id: string) => void
  /** Show the bulk-select checkbox column (default: true) */
  showSelect?: boolean
  /** Show a Location column (Inbox / chain workspaces) */
  showLocation?: boolean
  /** Render an "Escalated" pill in the reviewer cell when isEscalated=true */
  showEscalated?: boolean
}

const RESPONSE_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  draft: { label: 'Draft', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-700' },
  posted: { label: 'Posted', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  zomato: 'Zomato',
  offline: 'Offline',
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

export function ReviewTable({
  reviews,
  selectedIds,
  onToggleSelect,
  onRowClick,
  showSelect = true,
  showLocation = false,
  showEscalated = false,
}: ReviewTableProps) {
  const selected = selectedIds ?? new Set<string>()

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {showSelect && <TableHead className="w-10" />}
            <TableHead className="min-w-[200px]">Reviewer</TableHead>
            <TableHead className="w-[140px]">Rating</TableHead>
            <TableHead className="w-[110px]">Source</TableHead>
            {showLocation && (
              <TableHead className="w-[140px]">Location</TableHead>
            )}
            <TableHead className="min-w-[280px]">Review</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[140px] text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => {
            const hasResponse = !!review.latestResponse
            const isSelected = selected.has(review.id)
            const status = review.latestResponse?.status
            const statusConfig = status ? RESPONSE_STATUS_CONFIG[status] : null
            const reviewText = review.text ?? review.reviewText ?? ''
            const isOffline = review.source === 'offline'

            return (
              <TableRow
                key={review.id}
                data-state={isSelected ? 'selected' : undefined}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onRowClick(review.id)}
              >
                {showSelect && (
                  <TableCell
                    className="w-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!hasResponse && onToggleSelect ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(review.id)}
                        aria-label={`Select review by ${review.reviewerName ?? 'Anonymous'}`}
                      />
                    ) : (
                      <span className="block w-4" aria-hidden />
                    )}
                  </TableCell>
                )}

                <TableCell>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted shrink-0">
                      <User className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {review.reviewerName ?? 'Anonymous'}
                        </span>
                        {showEscalated && review.isEscalated && (
                          <Badge
                            variant="destructive"
                            className="gap-0.5 text-[10px] px-1.5 py-0"
                          >
                            <AlertTriangle className="size-2.5" />
                            Escalated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <StarRating rating={review.rating} size="sm" />
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="text-xs font-normal">
                    {isOffline ? (
                      <Smartphone className="size-3 mr-1" />
                    ) : (
                      <Globe className="size-3 mr-1" />
                    )}
                    {PLATFORM_LABELS[review.platform] ?? review.platform}
                  </Badge>
                </TableCell>

                {showLocation && (
                  <TableCell>
                    {review.locationName ? (
                      <span className="text-xs text-muted-foreground truncate block max-w-[120px]">
                        {review.locationName}
                      </span>
                    ) : (
                      <span className="text-xs opacity-40">—</span>
                    )}
                  </TableCell>
                )}

                <TableCell className="max-w-[420px]">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {reviewText || (
                      <span className="italic opacity-60">
                        No review text
                      </span>
                    )}
                  </p>
                </TableCell>

                <TableCell>
                  {statusConfig ? (
                    <Badge className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      No response
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {relativeTime(review.reviewedAt)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
