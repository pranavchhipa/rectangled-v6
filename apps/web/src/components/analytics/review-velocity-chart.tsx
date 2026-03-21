'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface ReviewVelocityChartProps {
  data: { date: string; count: number }[]
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
        Reviews:{' '}
        <span className="font-semibold text-foreground">
          {payload[0].value}
        </span>
      </p>
    </div>
  )
}

export function ReviewVelocityChart({ data }: ReviewVelocityChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    formattedDate: formatDate(d.date),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="velocityGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#5E50A0" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#5E50A0" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#5E50A0"
                strokeWidth={2}
                fill="url(#velocityGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: '#5E50A0',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
