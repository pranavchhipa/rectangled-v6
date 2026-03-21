'use client'

import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Users } from 'lucide-react'

interface CliSegmentChartProps {
  data: any
}

const CLI_SEGMENTS = [
  { label: 'Champions', key: 'champions', color: '#047857' },
  { label: 'Loyalists', key: 'loyalists', color: '#10B981' },
  { label: 'Passives', key: 'passives', color: '#F59E0B' },
  { label: 'At-Risk', key: 'atRisk', color: '#F97316' },
  { label: 'Detractors', key: 'detractors', color: '#EF4444' },
]

export function CliSegmentChart({ data }: CliSegmentChartProps) {
  const segments = useMemo(() => {
    if (!data) return []

    // Handle different response shapes
    const segmentData =
      data.segments ?? data.distribution ?? data

    return CLI_SEGMENTS.map((s) => {
      let count = 0
      if (Array.isArray(segmentData)) {
        const match = segmentData.find(
          (d: any) =>
            (d.segment ?? d.label ?? d.name ?? '')
              .toLowerCase()
              .replace(/[-_\s]/g, '') === s.key.toLowerCase()
        )
        count = match?.count ?? match?.value ?? 0
      } else if (segmentData && typeof segmentData === 'object') {
        count = segmentData[s.key] ?? 0
      }
      return { ...s, count }
    })
  }, [data])

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + s.count, 0),
    [segments]
  )

  const hasData = total > 0

  // Donut data
  const donutSegments = useMemo(() => {
    if (!hasData) return []
    let cumulative = 0
    return segments
      .filter((s) => s.count > 0)
      .map((s) => {
        const pct = (s.count / total) * 100
        const start = cumulative
        cumulative += pct
        return { ...s, pct, start }
      })
  }, [segments, total, hasData])

  const conicGradient = useMemo(() => {
    if (donutSegments.length === 0) return 'conic-gradient(#e5e7eb 0% 100%)'
    const stops = donutSegments
      .map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
      .join(', ')
    return `conic-gradient(${stops})`
  }, [donutSegments])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="flex items-center gap-1.5">
            CLI Segment Distribution
            <InfoTooltip text="Customer Loyalty Index — trust + satisfaction + advocacy composite (0-100)" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No loyalty data yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
              CLI segment data will appear once customer loyalty responses are
              collected.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Donut chart */}
            <div className="flex justify-center">
              <div className="relative">
                <div
                  className="w-36 h-36 rounded-full"
                  style={{ background: conicGradient }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-background flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">{total}</span>
                    <span className="text-[9px] text-muted-foreground">
                      Customers
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stacked bar */}
            <div className="w-full h-6 rounded-full overflow-hidden flex">
              {donutSegments.map((s) => (
                <div
                  key={s.key}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: s.color,
                    minWidth: s.pct > 0 ? '2px' : 0,
                  }}
                  title={`${s.label}: ${s.count} (${s.pct.toFixed(1)}%)`}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {segments.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {s.label}
                  </span>
                  <span className="text-xs font-semibold ml-auto tabular-nums">
                    {s.count}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                    {total > 0 ? ((s.count / total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
