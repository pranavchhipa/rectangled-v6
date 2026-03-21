'use client'

import { Card, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'

interface HealthScoreCardProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score < 40) return '#EF4444'
  if (score <= 70) return '#F59E0B'
  return '#10B981'
}

function getScoreLabel(score: number): string {
  if (score < 40) return 'Needs Attention'
  if (score <= 70) return 'Fair'
  return 'Excellent'
}

function getScoreDescription(score: number): string {
  if (score < 40)
    return 'Your review health needs improvement. Focus on responding to reviews and improving customer experience.'
  if (score <= 70)
    return 'Your review health is fair. Keep engaging with customers and addressing feedback to improve further.'
  return 'Your review health is excellent. Keep up the great work maintaining strong customer relationships.'
}

export function HealthScoreCard({ score }: HealthScoreCardProps) {
  const color = getScoreColor(score)
  const label = getScoreLabel(score)
  const description = getScoreDescription(score)

  // Calculate the circumference and offset for the SVG ring
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:gap-8 sm:px-10">
        {/* Circular Score Display */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg
            width="148"
            height="148"
            viewBox="0 0 148 148"
            className="-rotate-90"
          >
            {/* Background ring */}
            <circle
              cx="74"
              cy="74"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-muted/30"
            />
            {/* Score ring */}
            <circle
              cx="74"
              cy="74"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-4xl font-bold tabular-nums"
              style={{ color }}
            >
              {score}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              / 100
            </span>
          </div>
        </div>

        {/* Score Details */}
        <div className="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            Review Health Score
            <InfoTooltip text="Composite score based on rating, response rate, sentiment, and review velocity (0-100)" />
          </p>
          <p className="text-xl font-semibold" style={{ color }}>
            {label}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
