'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface RatingTrendChartProps {
  data: { date: string; avgRating: number }[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{formatDate(label)}</p>
      <p className="text-muted-foreground">
        Avg Rating:{' '}
        <span className="font-semibold text-foreground">
          {Number(payload[0].value).toFixed(2)}
        </span>
      </p>
    </div>
  )
}

export function RatingTrendChart({ data }: RatingTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    formattedDate: formatDate(d.date),
  }))

  // Calculate overall average for reference line
  const overallAvg =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.avgRating, 0) / data.length
      : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rating Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            >
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {overallAvg > 0 && (
                <ReferenceLine
                  y={overallAvg}
                  stroke="#6B7280"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: `Avg: ${overallAvg.toFixed(1)}`,
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: '#6B7280',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="avgRating"
                stroke="#5E50A0"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: '#5E50A0',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
