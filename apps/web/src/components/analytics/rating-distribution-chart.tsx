'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'

interface RatingDistributionChartProps {
  data: { rating: number; count: number }[]
}

const BAR_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#F59E0B',
  4: '#84CC16',
  5: '#10B981',
}

const STAR_LABELS: Record<number, string> = {
  1: '1\u2605',
  2: '2\u2605',
  3: '3\u2605',
  4: '4\u2605',
  5: '5\u2605',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { rating, count } = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{rating}-star reviews</p>
      <p className="text-muted-foreground">
        Count: <span className="font-semibold text-foreground">{count}</span>
      </p>
    </div>
  )
}

export function RatingDistributionChart({
  data,
}: RatingDistributionChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: STAR_LABELS[d.rating] ?? `${d.rating}\u2605`,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="flex items-center gap-1.5">
            Rating Distribution
            <InfoTooltip text="Distribution of star ratings across all reviews" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 13 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.rating}`}
                    fill={BAR_COLORS[entry.rating] ?? '#6B7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
