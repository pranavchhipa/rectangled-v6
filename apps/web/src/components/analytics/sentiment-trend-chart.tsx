'use client'

import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface SentimentTrendChartProps {
  data: { date: string; avgRating: number }[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SentimentTrendChart({ data }: SentimentTrendChartProps) {
  const chartDimensions = useMemo(() => {
    const width = 500
    const height = 200
    const padding = { top: 20, right: 20, bottom: 30, left: 40 }
    return { width, height, padding }
  }, [])

  // Convert rating trend to a sentiment-like score (0-100 scale)
  const sentimentData = useMemo(() => {
    return data.map((d) => ({
      date: d.date,
      score: ((d.avgRating - 1) / 4) * 100, // Map 1-5 to 0-100
    }))
  }, [data])

  const { points, areaPath, linePath } = useMemo(() => {
    if (sentimentData.length === 0) return { points: [], areaPath: '', linePath: '' }

    const { width, height, padding } = chartDimensions
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    const minScore = 0
    const maxScore = 100

    const pts = sentimentData.map((d, i) => ({
      x: padding.left + (i / Math.max(sentimentData.length - 1, 1)) * plotWidth,
      y: padding.top + (1 - (d.score - minScore) / (maxScore - minScore)) * plotHeight,
      score: d.score,
      date: d.date,
    }))

    // Build SVG polyline points
    const linePointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
    const line = `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`

    // Area path (fill below the line)
    const areaBottom = padding.top + plotHeight
    const area = `M ${pts[0].x} ${areaBottom} L ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${areaBottom} Z`

    return { points: pts, areaPath: area, linePath: line }
  }, [sentimentData, chartDimensions])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sentiment Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            No trend data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const { width, height, padding } = chartDimensions
  const plotHeight = height - padding.top - padding.bottom

  // X-axis labels
  const xLabels = useMemo(() => {
    if (sentimentData.length <= 6) {
      return sentimentData.map((d, i) => ({
        index: i,
        label: formatDate(d.date),
      }))
    }
    const step = Math.max(1, Math.floor(sentimentData.length / 5))
    return sentimentData
      .filter((_, i) => i === 0 || i === sentimentData.length - 1 || i % step === 0)
      .map((d, _, arr) => ({
        index: sentimentData.indexOf(d),
        label: formatDate(d.date),
      }))
  }, [sentimentData])

  // Midline at 50 (rating 3)
  const midlineY = padding.top + plotHeight * 0.5

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sentiment Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient
                id="sentimentGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.3} />
              </linearGradient>
            </defs>

            {/* Midline */}
            <line
              x1={padding.left}
              y1={midlineY}
              x2={width - padding.right}
              y2={midlineY}
              stroke="#6B7280"
              strokeWidth={0.5}
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <text
              x={padding.left - 4}
              y={midlineY}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              3.0
            </text>

            {/* Area fill */}
            <path d={areaPath} fill="url(#sentimentGrad)" opacity={0.4} />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="#10B981"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dots */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={p.score >= 50 ? '#10B981' : '#EF4444'}
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}

            {/* X-axis labels */}
            {xLabels.map((xl) => {
              const pt = points[xl.index]
              if (!pt) return null
              return (
                <text
                  key={xl.index}
                  x={pt.x}
                  y={height - 5}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={10}
                >
                  {xl.label}
                </text>
              )
            })}

            {/* Y-axis labels */}
            <text
              x={padding.left - 4}
              y={padding.top}
              textAnchor="end"
              dominantBaseline="hanging"
              className="fill-muted-foreground"
              fontSize={9}
            >
              5.0
            </text>
            <text
              x={padding.left - 4}
              y={padding.top + plotHeight}
              textAnchor="end"
              dominantBaseline="auto"
              className="fill-muted-foreground"
              fontSize={9}
            >
              1.0
            </text>
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
