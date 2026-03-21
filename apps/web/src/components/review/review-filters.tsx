'use client'

import { Search, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ReviewFiltersProps {
  platform: string
  onPlatformChange: (value: string) => void
  minRating: number | undefined
  onMinRatingChange: (value: number | undefined) => void
  sentiment: string
  onSentimentChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
}

export function ReviewFilters({
  platform,
  onPlatformChange,
  minRating,
  onMinRatingChange,
  sentiment,
  onSentimentChange,
  search,
  onSearchChange,
}: ReviewFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search reviews..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Platform filter */}
      <Select value={platform} onValueChange={onPlatformChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          <SelectItem value="google">Google</SelectItem>
          <SelectItem value="zomato">Zomato</SelectItem>
        </SelectContent>
      </Select>

      {/* Rating filter */}
      <div className="flex items-center gap-1 rounded-lg border px-2 py-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Button
            key={star}
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              onMinRatingChange(minRating === star ? undefined : star)
            }
            className={cn(
              'size-7',
              minRating !== undefined && star <= minRating
                ? 'text-amber-500'
                : 'text-muted-foreground'
            )}
          >
            <Star
              className={cn(
                'size-4',
                minRating !== undefined && star <= minRating
                  ? 'fill-amber-400'
                  : ''
              )}
            />
          </Button>
        ))}
      </div>

      {/* Sentiment filter */}
      <Select value={sentiment} onValueChange={onSentimentChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sentiment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sentiment</SelectItem>
          <SelectItem value="positive">Positive</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
          <SelectItem value="negative">Negative</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
