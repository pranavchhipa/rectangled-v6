'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface ResponseRateCardProps {
  data: {
    total: number
    responded: number
    rate: number
  }
}

function getRateColor(rate: number): string {
  if (rate < 40) return '#EF4444'
  if (rate <= 70) return '#F59E0B'
  return '#10B981'
}

function getRateLabel(rate: number): string {
  if (rate < 40) return 'Low'
  if (rate <= 70) return 'Moderate'
  return 'High'
}

export function ResponseRateCard({ data }: ResponseRateCardProps) {
  const { total, responded, rate } = data
  const color = getRateColor(rate)
  const label = getRateLabel(rate)
  const roundedRate = Math.round(rate)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Response Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5">
        {/* Large percentage display */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-5xl font-bold tabular-nums"
            style={{ color }}
          >
            {roundedRate}%
          </span>
          <span
            className="text-sm font-medium"
            style={{ color }}
          >
            {label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <Progress
            value={rate}
            className="h-3"
            style={
              {
                '--progress-color': color,
              } as React.CSSProperties
            }
          />
          <p className="text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{responded}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span> reviews
            responded
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
