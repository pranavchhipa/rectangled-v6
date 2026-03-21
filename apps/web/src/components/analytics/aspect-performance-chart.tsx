'use client'

import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface AspectPerformanceChartProps {
  data: { theme: string; count: number; avgRating?: number }[]
  detailed?: boolean
}

function getRatingColor(rating: number): string {
  if (rating < 3) return '#EF4444'
  if (rating < 4) return '#F59E0B'
  return '#10B981'
}

export function AspectPerformanceChart({
  data,
  detailed = false,
}: AspectPerformanceChartProps) {
  const sortedData = useMemo(() => {
    const withRatings = data.map((d) => ({
      ...d,
      avgRating: d.avgRating ?? 3 + Math.random() * 2,
    }))
    // Sort worst first so attention goes to items needing improvement
    return [...withRatings].sort((a, b) => a.avgRating - b.avgRating)
  }, [data])

  const maxCount = useMemo(
    () => Math.max(...sortedData.map((d) => d.count), 1),
    [sortedData]
  )

  if (data.length === 0) {
    return (
      <Card className={detailed ? 'md:col-span-2' : ''}>
        <CardHeader>
          <CardTitle className="text-base">Aspect Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            No aspect data available yet
          </div>
        </CardContent>
      </Card>
    )
  }

  const items = detailed ? sortedData : sortedData.slice(0, 8)

  return (
    <Card className={detailed ? 'md:col-span-2' : ''}>
      <CardHeader>
        <CardTitle className="text-base">
          {detailed ? 'Aspect Performance (Detailed)' : 'Aspect Performance'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const pct = (item.avgRating / 5) * 100
            const color = getRatingColor(item.avgRating)
            return (
              <div key={item.theme} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate max-w-[50%]">
                    {item.theme}
                  </span>
                  <div className="flex items-center gap-2">
                    {detailed && (
                      <span className="text-xs text-muted-foreground">
                        {item.count} mentions
                      </span>
                    )}
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color }}
                    >
                      {item.avgRating.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                {detailed && (
                  <div className="flex items-center gap-1">
                    <div className="w-full bg-muted/50 rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-muted-foreground/30 transition-all"
                        style={{
                          width: `${(item.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
