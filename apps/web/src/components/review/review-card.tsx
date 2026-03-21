'use client'

import { formatDistanceToNow } from 'date-fns'
import { Globe, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

interface ReviewCardProps {
  review: ReviewData
  onClick: () => void
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

export function ReviewCard({ review, onClick }: ReviewCardProps) {
  const responseStatus = review.latestResponse?.status
  const statusConfig = responseStatus
    ? RESPONSE_STATUS_CONFIG[responseStatus]
    : null

  let timeAgo: string
  try {
    timeAgo = formatDistanceToNow(new Date(review.reviewedAt), {
      addSuffix: true,
    })
  } catch {
    timeAgo = ''
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted shrink-0">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {review.reviewerName ?? 'Anonymous'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} size="sm" />
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs">
            <Globe className="size-3 mr-1" />
            {PLATFORM_LABELS[review.platform] ?? review.platform}
          </Badge>
          {statusConfig ? (
            <Badge className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          ) : (
            <Badge variant="secondary">No response</Badge>
          )}
        </div>
      </div>

      {review.text && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
          {review.text}
        </p>
      )}
    </button>
  )
}
