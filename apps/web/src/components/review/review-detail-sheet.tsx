'use client'

import { formatDistanceToNow } from 'date-fns'
import { Globe, User } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StarRating } from './star-rating'
import { AIResponseSection } from './ai-response-section'

interface ReviewDetailSheetProps {
  reviewId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  zomato: 'Zomato',
}

export function ReviewDetailSheet({
  reviewId,
  open,
  onOpenChange,
}: ReviewDetailSheetProps) {
  const reviewQuery = trpc.review.getById.useQuery(
    { reviewId: reviewId! },
    { enabled: !!reviewId && open }
  )

  const review = reviewQuery.data

  let timeAgo = ''
  if (review?.reviewedAt) {
    try {
      timeAgo = formatDistanceToNow(new Date(review.reviewedAt), {
        addSuffix: true,
      })
    } catch {
      // ignore
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Review Details</SheetTitle>
        </SheetHeader>

        {reviewQuery.isLoading ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : review ? (
          <div className="mt-6 space-y-6">
            {/* Review header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <User className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {review.reviewerName ?? 'Anonymous'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      <Globe className="size-3 mr-1" />
                      {PLATFORM_LABELS[review.platform] ?? review.platform}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo}
                    </span>
                  </div>
                </div>
              </div>

              <StarRating rating={review.rating} size="lg" />

              {/* Review text */}
              {review.text ? (
                <p className="text-sm leading-relaxed">{review.text}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No text provided with this review.
                </p>
              )}

              {/* Sentiment */}
              {review.sentiment && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Sentiment:
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      review.sentiment === 'positive'
                        ? 'text-emerald-600 border-emerald-200'
                        : review.sentiment === 'negative'
                          ? 'text-red-600 border-red-200'
                          : 'text-gray-600'
                    }
                  >
                    {review.sentiment}
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* AI Response section */}
            <AIResponseSection
              reviewId={review.id}
              responses={(review.responses ?? []) as any}
            />
          </div>
        ) : (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Review not found.
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
