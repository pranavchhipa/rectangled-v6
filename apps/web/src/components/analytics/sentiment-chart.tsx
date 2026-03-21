'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'

interface SentimentChartProps {
  data: { sentiment: string; count: number }[]
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280',
  mixed: '#F59E0B',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { sentiment, count, percent } = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium capitalize">{sentiment}</p>
      <p className="text-muted-foreground">
        Count: <span className="font-semibold text-foreground">{count}</span>
      </p>
      <p className="text-muted-foreground">
        Share:{' '}
        <span className="font-semibold text-foreground">
          {(percent * 100).toFixed(1)}%
        </span>
      </p>
    </div>
  )
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-sm">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize text-muted-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SentimentChart({ data }: SentimentChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const chartData = data.map((d) => ({
    ...d,
    percent: total > 0 ? d.count / total : 0,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="flex items-center gap-1.5">
            Sentiment Breakdown
            <InfoTooltip text="Overall emotional tone of reviews — positive, negative, neutral, or mixed" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="count"
                nameKey="sentiment"
                strokeWidth={0}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.sentiment}`}
                    fill={SENTIMENT_COLORS[entry.sentiment] ?? '#6B7280'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
