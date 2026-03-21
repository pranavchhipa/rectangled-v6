'use client'

import { MessageSquare, Star, Reply, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface ReviewStats {
  totalReviews: number
  averageRating: number
  responseRate: number
  sentimentBreakdown: {
    positive: number
    negative: number
    neutral: number
  }
}

interface ReviewStatsBarProps {
  stats?: ReviewStats
  isLoading: boolean
}

export function ReviewStatsBar({ stats, isLoading }: ReviewStatsBarProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border bg-card p-4"
          >
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: 'Total Reviews',
      value: stats?.totalReviews ?? 0,
      icon: MessageSquare,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Average Rating',
      value: stats?.averageRating?.toFixed(1) ?? '0.0',
      icon: Star,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Response Rate',
      value: `${stats?.responseRate ?? 0}%`,
      icon: Reply,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Positive',
      value: stats?.sentimentBreakdown.positive ?? 0,
      icon: TrendingUp,
      color: 'bg-blue-100 text-blue-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 rounded-xl border bg-card p-4"
        >
          <div
            className={`flex size-10 items-center justify-center rounded-lg ${card.color}`}
          >
            <card.icon className="size-5" />
          </div>
          <div>
            <p className="text-lg font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
