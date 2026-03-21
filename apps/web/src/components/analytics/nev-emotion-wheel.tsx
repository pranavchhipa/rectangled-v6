'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Heart } from 'lucide-react'

interface NevEmotionWheelProps {
  data: any
}

interface EmotionEntry {
  emotion: string
  intensity: number
  count: number
}

const QUADRANTS = [
  {
    label: 'Joy',
    color: '#10B981',
    bgColor: '#10B98115',
    emotions: ['happy', 'delighted', 'excited', 'grateful', 'satisfied'],
  },
  {
    label: 'Comfort',
    color: '#3B82F6',
    bgColor: '#3B82F615',
    emotions: ['calm', 'relaxed', 'safe', 'welcomed', 'valued'],
  },
  {
    label: 'Frustration',
    color: '#F59E0B',
    bgColor: '#F59E0B15',
    emotions: ['annoyed', 'disappointed', 'impatient', 'confused', 'neglected'],
  },
  {
    label: 'Anxiety',
    color: '#EF4444',
    bgColor: '#EF444415',
    emotions: ['worried', 'stressed', 'overwhelmed', 'uncertain', 'angry'],
  },
]

export function NevEmotionWheel({ data }: NevEmotionWheelProps) {
  // Extract emotion clusters from NEV analytics data
  const emotionClusters = data?.emotionClusters ?? data?.clusters ?? null
  const emotionBreakdown = data?.emotionBreakdown ?? data?.emotions ?? null

  // Build quadrant data from available data
  const quadrantData = QUADRANTS.map((quadrant) => {
    let emotions: EmotionEntry[] = []

    if (emotionBreakdown && Array.isArray(emotionBreakdown)) {
      emotions = emotionBreakdown
        .filter((e: any) => {
          const name = (e.emotion ?? e.name ?? '').toLowerCase()
          return quadrant.emotions.some(
            (qe) => name.includes(qe) || qe.includes(name)
          )
        })
        .map((e: any) => ({
          emotion: e.emotion ?? e.name ?? 'Unknown',
          intensity: e.avgIntensity ?? e.intensity ?? 0,
          count: e.count ?? 0,
        }))
        .slice(0, 3)
    }

    return {
      ...quadrant,
      emotionData: emotions,
    }
  })

  const hasEmotionData = quadrantData.some((q) => q.emotionData.length > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="flex items-center gap-1.5">
            NEV Emotion Wheel
            <InfoTooltip text="Net Emotional Value — positive vs negative emotion ratio (-100 to +100)" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasEmotionData ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Heart className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Emotion data coming soon
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
              NEV emotion analysis will populate once enough feedback responses
              are collected.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {quadrantData.map((quadrant) => (
              <div
                key={quadrant.label}
                className="rounded-lg p-3 space-y-2"
                style={{ backgroundColor: quadrant.bgColor }}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: quadrant.color }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: quadrant.color }}
                  >
                    {quadrant.label}
                  </span>
                </div>
                {quadrant.emotionData.length > 0 ? (
                  <div className="space-y-1.5">
                    {quadrant.emotionData.map((e) => (
                      <div key={e.emotion} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="capitalize truncate">
                            {e.emotion}
                          </span>
                          <span className="font-medium tabular-nums">
                            {e.intensity.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${(e.intensity / 5) * 100}%`,
                              backgroundColor: quadrant.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">
                    No data yet
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
