'use client'

import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface SourceDonutChartProps {
  data: { platform: string; count: number; avgRating?: number }[]
}

const PLATFORM_COLORS: Record<string, string> = {
  google: '#4285F4',
  zomato: '#E23744',
  offline: '#F59E0B',
  yelp: '#D32323',
  facebook: '#1877F2',
  tripadvisor: '#00AF87',
}

function getColor(platform: string, index: number): string {
  const key = platform.toLowerCase()
  if (PLATFORM_COLORS[key]) return PLATFORM_COLORS[key]
  const fallback = ['#5E50A0', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
  return fallback[index % fallback.length]
}

export function SourceDonutChart({ data }: SourceDonutChartProps) {
  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.count, 0),
    [data]
  )

  const segments = useMemo(() => {
    if (total === 0) return []
    let cumulative = 0
    return data.map((d, i) => {
      const pct = (d.count / total) * 100
      const start = cumulative
      cumulative += pct
      return {
        platform: d.platform,
        count: d.count,
        pct,
        start,
        color: getColor(d.platform, i),
      }
    })
  }, [data, total])

  const conicGradient = useMemo(() => {
    if (segments.length === 0) return 'conic-gradient(#e5e7eb 0% 100%)'
    const stops = segments
      .map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
      .join(', ')
    return `conic-gradient(${stops})`
  }, [segments])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            No source data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Source Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-8">
          {/* Donut using CSS conic-gradient */}
          <div className="relative">
            <div
              className="w-40 h-40 rounded-full"
              style={{ background: conicGradient }}
            />
            {/* Inner hole */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-background flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{total}</span>
                <span className="text-[10px] text-muted-foreground">Total</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2.5">
            {segments.map((s) => (
              <div key={s.platform} className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize truncate">
                    {s.platform}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.count} ({s.pct.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
