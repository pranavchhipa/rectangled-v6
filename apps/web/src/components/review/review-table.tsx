'use client'

import { formatDistanceToNow } from 'date-fns'
import { Globe, User } from 'lucide-react'
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

interface ReviewData {
  id: string
  platform: string
  platformReviewId: string
  reviewerName: string | null
  rating: number
  text: string | null
  reviewedAt: string
  sentiment: string | null
  latestResponse: ReviewResponse | null
}

interface ReviewTableProps {
  reviews: ReviewData[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onRowClick: (id: string) => void
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
}: ReviewTableProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10" />
            <TableHead className="min-w-[200px]">Reviewer</TableHead>
            <TableHead className="w-[140px]">Rating</TableHead>
            <TableHead className="w-[110px]">Platform</TableHead>
            <TableHead className="min-w-[300px]">Review</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[140px] text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => {
            const hasResponse = !!review.latestResponse
            const isSelected = selectedIds.has(review.id)
            const status = review.latestResponse?.status
            const statusConfig = status ? RESPONSE_STATUS_CONFIG[status] : null

            return (
              <TableRow
                key={review.id}
                data-state={isSelected ? 'selected' : undefined}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onRowClick(review.id)}
              >
                <TableCell
                  className="w-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!hasResponse ? (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(review.id)}
                      aria-label={`Select review by ${review.reviewerName ?? 'Anonymous'}`}
                    />
                  ) : (
                    <span className="block w-4" aria-hidden />
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted shrink-0">
                      <User className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-sm truncate">
                      {review.reviewerName ?? 'Anonymous'}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <StarRating rating={review.rating} size="sm" />
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="text-xs font-normal">
                    <Globe className="size-3 mr-1" />
                    {PLATFORM_LABELS[review.platform] ?? review.platform}
                  </Badge>
                </TableCell>

                <TableCell className="max-w-[420px]">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {review.text || (
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
