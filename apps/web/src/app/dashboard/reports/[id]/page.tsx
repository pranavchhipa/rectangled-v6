'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Download,
  Share2,
  Calendar,
  Star,
  MessageSquare,
  ThumbsUp,
  Users,
  Route,
  Clock,
  TrendingUp,
  Loader2,
  FileText,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'

// ─── Type Badge ───
const REPORT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  orm_overview: { label: 'ORM Overview', color: '#3B82F6' },
  aspect_analysis: { label: 'Aspect Analysis', color: '#8B5CF6' },
  truforms_feedback: { label: 'TruForms Feedback', color: '#10B981' },
  journey_analytics: { label: 'Journey Analytics', color: '#F59E0B' },
  nev_report: { label: 'NEV Report', color: '#EC4899' },
  cli_report: { label: 'CLI Report', color: '#06B6D4' },
}

// ─── CSS Bar Chart Component ───
function BarChartCSS({
  data,
  labelKey,
  valueKey,
  color,
  maxValue,
}: {
  data: any[]
  labelKey: string
  valueKey: string
  color: string
  maxValue?: number
}) {
  const max = maxValue ?? Math.max(...data.map((d) => d[valueKey] ?? 0), 1)
  return (
    <div className="flex items-end gap-1.5 h-44">
      {data.map((d, i) => {
        const val = d[valueKey] ?? 0
        const pct = (val / max) * 100
        return (
          <div
            key={i}
            className="flex flex-col items-center flex-1 min-w-0"
          >
            <div className="w-full flex justify-center">
              <span className="text-[9px] text-muted-foreground tabular-nums mb-0.5">
                {val}
              </span>
            </div>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                maxWidth: '40px',
              }}
            />
            <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
              {d[labelKey]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Horizontal Bar ───
function HorizontalBar({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string
  value: number
  max: number
  color: string
  suffix?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── Donut Chart (CSS) ───
function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[]
  centerLabel?: string
  centerValue?: string | number
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return null

  let cumPct = 0
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = (s.value / total) * 100
      const start = cumPct
      cumPct += pct
      return `${s.color} ${start}% ${start + pct}%`
    })
    .join(', ')

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <div
          className="w-32 h-32 rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-background flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-lg font-bold">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[9px] text-muted-foreground">
                {centerLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium ml-auto tabular-nums">
                {s.value}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ─── NPS Gauge ───
function NpsGauge({ score }: { score: number }) {
  const normalizedAngle = ((score + 100) / 200) * 180
  const isPositive = score > 0
  const color = isPositive ? '#10B981' : score === 0 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Background arc */}
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-muted/30"
            strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(normalizedAngle / 180) * Math.PI * 90} ${Math.PI * 90}`}
          />
          {/* Needle */}
          <line
            x1="100"
            y1="100"
            x2={100 + 70 * Math.cos((Math.PI * (180 - normalizedAngle)) / 180)}
            y2={100 - 70 * Math.sin((Math.PI * (180 - normalizedAngle)) / 180)}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="4" fill={color} />
        </svg>
      </div>
      <div className="text-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {score}
        </span>
        <p className="text-xs text-muted-foreground mt-0.5">NPS Score</p>
      </div>
      {/* Scale labels */}
      <div className="flex justify-between w-48 text-[9px] text-muted-foreground -mt-1">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>
    </div>
  )
}

// ─── Completion Funnel ───
function CompletionFunnel({
  data,
  totalSessions,
}: {
  data: { screenOrder: number; sessions: number }[]
  totalSessions: number
}) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No funnel data available</p>
  const max = totalSessions || data[0]?.sessions || 1

  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = (d.sessions / max) * 100
        const prevPct = i > 0 ? (data[i - 1].sessions / max) * 100 : 100
        const dropOff = i > 0 ? data[i - 1].sessions - d.sessions : 0
        return (
          <div key={d.screenOrder} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">Screen {d.screenOrder}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{d.sessions} sessions</span>
                {dropOff > 0 && (
                  <span className="text-red-500 text-[10px]">
                    -{dropOff} drop
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  backgroundColor:
                    pct > 70
                      ? '#10B981'
                      : pct > 40
                        ? '#F59E0B'
                        : '#EF4444',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Rating Distribution Bars ───
function RatingBars({
  data,
}: {
  data: { rating: number; count: number }[]
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const max = Math.max(...data.map((d) => d.count), 1)
  const colors: Record<number, string> = {
    1: '#EF4444',
    2: '#F97316',
    3: '#F59E0B',
    4: '#84CC16',
    5: '#10B981',
  }

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((rating) => {
        const item = data.find((d) => d.rating === rating)
        const count = item?.count ?? 0
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
        return (
          <div key={rating} className="flex items-center gap-2">
            <div className="flex items-center gap-1 w-12 shrink-0">
              <span className="text-xs font-medium">{rating}</span>
              <Star className="size-3 fill-amber-400 text-amber-400" />
            </div>
            <div className="flex-1 bg-muted rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${(count / max) * 100}%`,
                  backgroundColor: colors[rating] ?? '#6B7280',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
              {count} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat Card ───
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  subtitle?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── ORM Overview Section ───
function OrmOverviewReport({ data }: { data: Record<string, any> }) {
  const ratingDist = (data.ratingDistribution ?? []) as {
    rating: number
    count: number
  }[]
  const sourceBd = (data.sourceBreakdown ?? []) as {
    source: string
    count: number
  }[]
  const volumeTrend = (data.volumeTrend ?? []) as {
    date: string
    count: number
  }[]
  const topPos = (data.topPositiveAspects ?? []) as {
    aspect: string
    count: number
  }[]
  const topNeg = (data.topNegativeAspects ?? []) as {
    aspect: string
    count: number
  }[]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Reviews"
          value={data.totalReviews ?? 0}
          icon={MessageSquare}
          color="#3B82F6"
        />
        <StatCard
          title="Average Rating"
          value={(data.averageRating ?? 0).toFixed(1)}
          icon={Star}
          color="#F59E0B"
        />
        <StatCard
          title="Response Rate"
          value={`${data.responseRate ?? 0}%`}
          icon={ThumbsUp}
          color="#8B5CF6"
        />
        <StatCard
          title="Online Reviews"
          value={data.onlineCount ?? 0}
          icon={TrendingUp}
          color="#10B981"
        />
        <StatCard
          title="Offline Reviews"
          value={data.offlineCount ?? 0}
          icon={Users}
          color="#F97316"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingBars data={ratingDist} />
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={sourceBd.map((s) => ({
                label: s.source === 'online' ? 'Online' : 'Offline',
                value: s.count,
                color: s.source === 'online' ? '#3B82F6' : '#F59E0B',
              }))}
              centerLabel="Total"
              centerValue={data.totalReviews}
            />
          </CardContent>
        </Card>

        {/* Volume Trend */}
        {volumeTrend.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Review Volume Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChartCSS
                data={volumeTrend.map((d) => ({
                  label: format(new Date(d.date), 'MMM d'),
                  value: d.count,
                }))}
                labelKey="label"
                valueKey="value"
                color="#5E50A0"
              />
            </CardContent>
          </Card>
        )}

        {/* Top Positive Aspects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Positive Aspects</CardTitle>
          </CardHeader>
          <CardContent>
            {topPos.length > 0 ? (
              <div className="space-y-2">
                {topPos.map((a) => (
                  <HorizontalBar
                    key={a.aspect}
                    label={a.aspect}
                    value={a.count}
                    max={topPos[0].count}
                    color="#10B981"
                    suffix=" mentions"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Negative Aspects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Negative Aspects</CardTitle>
          </CardHeader>
          <CardContent>
            {topNeg.length > 0 ? (
              <div className="space-y-2">
                {topNeg.map((a) => (
                  <HorizontalBar
                    key={a.aspect}
                    label={a.aspect}
                    value={a.count}
                    max={topNeg[0].count}
                    color="#EF4444"
                    suffix=" mentions"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Aspect Analysis Section ───
function AspectAnalysisReport({ data }: { data: Record<string, any> }) {
  const perAspect = (data.perAspectScores ?? []) as {
    aspect: string
    avgRating: number
    mentionCount: number
  }[]
  const critical = (data.criticalAspects ?? []) as {
    aspect: string
    avgRating: number
    mentionCount: number
  }[]
  const maxMentions = Math.max(...perAspect.map((a) => a.mentionCount), 1)

  return (
    <div className="space-y-6">
      {/* Critical aspects alert */}
      {critical.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base text-red-700 dark:text-red-400">
              Critical Aspects (Avg Rating &lt; 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {critical.map((a) => (
                <div
                  key={a.aspect}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-[10px]">
                      {a.avgRating.toFixed(1)}
                    </Badge>
                    <span className="text-sm font-medium">{a.aspect}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {a.mentionCount} mentions
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Per-Aspect Scores */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Aspect Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {perAspect.map((a) => {
                const color =
                  a.avgRating < 3
                    ? '#EF4444'
                    : a.avgRating < 4
                      ? '#F59E0B'
                      : '#10B981'
                return (
                  <div key={a.aspect} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{a.aspect}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {a.mentionCount} mentions
                        </span>
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color }}
                        >
                          {a.avgRating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all"
                        style={{
                          width: `${(a.avgRating / 5) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Mention Frequency */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Aspect Mention Frequency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {perAspect.slice(0, 10).map((a) => (
                <HorizontalBar
                  key={a.aspect}
                  label={a.aspect}
                  value={a.mentionCount}
                  max={maxMentions}
                  color="#5E50A0"
                  suffix=" mentions"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── TruForms Report Section ───
function TruformsReport({ data }: { data: Record<string, any> }) {
  const npsBreakdown = data.npsBreakdown as
    | {
        promoters: number
        passives: number
        detractors: number
        total: number
      }
    | undefined
  const perForm = (data.perFormStats ?? []) as {
    formId: string
    formName: string
    formType: string
    responseCount: number
    avgScore: number
    completionRate: number
  }[]

  return (
    <div className="space-y-6">
      {/* Scores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Responses"
          value={data.totalResponses ?? 0}
          icon={MessageSquare}
          color="#3B82F6"
        />
        <StatCard
          title="CSAT Score"
          value={(data.csatScore ?? 0).toFixed(1)}
          icon={Star}
          color="#F59E0B"
        />
        <StatCard
          title="CES Score"
          value={(data.cesScore ?? 0).toFixed(1)}
          icon={ThumbsUp}
          color="#8B5CF6"
        />
        <StatCard
          title="NPS Score"
          value={data.npsScore ?? 0}
          icon={TrendingUp}
          color={
            (data.npsScore ?? 0) > 0
              ? '#10B981'
              : (data.npsScore ?? 0) === 0
                ? '#F59E0B'
                : '#EF4444'
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* NPS Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Promoter Score</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <NpsGauge score={data.npsScore ?? 0} />
          </CardContent>
        </Card>

        {/* NPS Breakdown */}
        {npsBreakdown && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NPS Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <HorizontalBar
                  label="Promoters (9-10)"
                  value={npsBreakdown.promoters}
                  max={npsBreakdown.total || 1}
                  color="#10B981"
                />
                <HorizontalBar
                  label="Passives (7-8)"
                  value={npsBreakdown.passives}
                  max={npsBreakdown.total || 1}
                  color="#F59E0B"
                />
                <HorizontalBar
                  label="Detractors (0-6)"
                  value={npsBreakdown.detractors}
                  max={npsBreakdown.total || 1}
                  color="#EF4444"
                />
              </div>
              {/* Stacked bar */}
              {npsBreakdown.total > 0 && (
                <div className="w-full h-4 rounded-full overflow-hidden flex mt-4">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${(npsBreakdown.promoters / npsBreakdown.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${(npsBreakdown.passives / npsBreakdown.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${(npsBreakdown.detractors / npsBreakdown.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Per-Form Stats Table */}
        {perForm.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Per-Form Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Responses</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perForm.map((f) => (
                    <TableRow key={f.formId}>
                      <TableCell className="font-medium">
                        {f.formName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {f.formType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.responseCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.avgScore.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.completionRate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Journey Analytics Section ───
function JourneyAnalyticsReport({ data }: { data: Record<string, any> }) {
  const dropOff = (data.dropOffByScreen ?? []) as {
    screenOrder: number
    sessions: number
  }[]
  const perJourney = (data.perJourneyStats ?? []) as {
    journeyId: string
    journeyName: string
    totalSessions: number
    completedSessions: number
    completionRate: number
    screenCount: number
  }[]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sessions"
          value={data.totalSessions ?? 0}
          icon={Users}
          color="#3B82F6"
        />
        <StatCard
          title="Completion Rate"
          value={`${data.completionRate ?? 0}%`}
          icon={TrendingUp}
          color="#10B981"
        />
        <StatCard
          title="Avg Completion Time"
          value={`${data.avgCompletionTimeSec ?? 0}s`}
          icon={Clock}
          color="#8B5CF6"
        />
        <StatCard
          title="Reviews Generated"
          value={data.reviewsGenerated ?? 0}
          icon={MessageSquare}
          color="#F59E0B"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Completion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletionFunnel
              data={dropOff}
              totalSessions={data.totalSessions ?? 0}
            />
          </CardContent>
        </Card>

        {/* Positive/Negative Ratio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sentiment Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={[
                {
                  label: 'Positive',
                  value: data.positiveRatio ?? 0,
                  color: '#10B981',
                },
                {
                  label: 'Negative',
                  value: 100 - (data.positiveRatio ?? 0),
                  color: '#EF4444',
                },
              ]}
              centerLabel="Positive"
              centerValue={`${data.positiveRatio ?? 0}%`}
            />
          </CardContent>
        </Card>

        {/* Per-Journey Stats */}
        {perJourney.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Per-Journey Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Journey</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Screens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perJourney.map((j) => (
                    <TableRow key={j.journeyId}>
                      <TableCell className="font-medium">
                        {j.journeyName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.totalSessions}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.completedSessions}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={
                            j.completionRate >= 70
                              ? 'text-green-600'
                              : j.completionRate >= 40
                                ? 'text-amber-600'
                                : 'text-red-500'
                          }
                        >
                          {j.completionRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.screenCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Main Report Viewer Page ───
export default function ReportViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()
  const reportId = params.id as string

  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const reportQuery = trpc.report.get.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      membershipId: currentWorkspaceId!,
      reportId,
    },
    { enabled: !!currentWorkspaceId && !!reportId }
  )

  const shareMutation = trpc.report.share.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/shared/report/${data.shareToken}`
      setShareUrl(url)
      setShareOpen(true)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to share report')
    },
  })

  const exportPdfMutation = trpc.report.exportPdf.useMutation({
    onSuccess: (data) => {
      const binaryStr = atob(data.pdf)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report?.title ?? 'report'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to export PDF')
    },
  })

  const report = reportQuery.data as any
  const reportData = (report?.data ?? {}) as Record<string, any>
  const typeConfig = REPORT_TYPE_LABELS[report?.reportType] ?? {
    label: report?.reportType ?? 'Report',
    color: '#6B7280',
  }

  if (reportQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4 pt-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (reportQuery.isError || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="size-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Report not found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The report you are looking for may have been deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/dashboard/analytics')}
        >
          <ArrowLeft className="size-4" />
          Back to Analytics
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/analytics')}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className="text-xs"
                style={{
                  backgroundColor: `${typeConfig.color}15`,
                  color: typeConfig.color,
                  borderColor: 'transparent',
                }}
              >
                {typeConfig.label}
              </Badge>
            </div>
            <h1 className="text-xl font-bold">{report.title}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="size-3.5" />
              {report.dateFrom
                ? format(new Date(report.dateFrom), 'MMM d, yyyy')
                : ''}{' '}
              &mdash;{' '}
              {report.dateTo
                ? format(new Date(report.dateTo), 'MMM d, yyyy')
                : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              shareMutation.mutate({
                workspaceId: currentWorkspaceId!,
                membershipId: currentWorkspaceId!,
                reportId,
              })
            }
            disabled={shareMutation.isPending}
          >
            <Share2 className="size-4" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportPdfMutation.mutate({
                workspaceId: currentWorkspaceId!,
                membershipId: currentWorkspaceId!,
                reportId,
              })
            }
            disabled={exportPdfMutation.isPending}
          >
            {exportPdfMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Report Content */}
      {report.reportType === 'orm_overview' && (
        <OrmOverviewReport data={reportData} />
      )}
      {report.reportType === 'aspect_analysis' && (
        <AspectAnalysisReport data={reportData} />
      )}
      {report.reportType === 'truforms_feedback' && (
        <TruformsReport data={reportData} />
      )}
      {report.reportType === 'journey_analytics' && (
        <JourneyAnalyticsReport data={reportData} />
      )}

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Report</DialogTitle>
            <DialogDescription>
              Anyone with this link can view this report.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl} className="text-sm" />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                toast.success('Link copied to clipboard')
              }}
              size="sm"
              variant="secondary"
            >
              Copy
            </Button>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  )
}
