'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  Star,
  MessageSquare,
  Reply,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MapPin,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

/**
 * Phase 2 Stage D — Chain rollup dashboard.
 *
 * Org-scoped overview that aggregates across every workspace + location
 * the user belongs to. KPI strip up top, sentiment breakdown bar, then
 * a sortable per-location leaderboard.
 *
 * Backend wired through `chain.*` (Phase 2 Stage C, commit 56ca7c1):
 *   - chain.getOverviewKpis           → KPI strip
 *   - chain.getLocationLeaderboard    → leaderboard table
 *   - chain.getRatingTrendsByLocation → (deferred — chart over time)
 *   - chain.getGeoDistribution        → (deferred — needs map lib)
 *   - chain.getResponseTimeHeatmap    → (deferred)
 *   - chain.getEscalationLoad         → (deferred — separate widget)
 *
 * Visible only when an organization is selected. Workspaces without an
 * organization see an explanatory empty state pointing at /dashboard/settings.
 */

type RangePreset = '7d' | '30d' | '90d'
type SortBy =
  | 'reviews'
  | 'avgRating'
  | 'responseRate'
  | 'openEscalations'
  | 'slaBreach'
type SortDir = 'asc' | 'desc'

const RANGE_PRESETS: Array<{ value: RangePreset; label: string; days: number }> = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
]

function fmtMinutes(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

function fmtRating(r: number | null | undefined): string {
  if (r == null) return '—'
  return r.toFixed(1)
}

export default function ChainDashboardPage() {
  const currentOrganizationId = useAuthStore((s) => s.currentOrganizationId)
  const memberships = useAuthStore((s) => s.memberships)

  const [range, setRange] = useState<RangePreset>('30d')
  const [sortBy, setSortBy] = useState<SortBy>('reviews')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const dateWindow = useMemo(() => {
    const days = RANGE_PRESETS.find((r) => r.value === range)?.days ?? 30
    const to = new Date()
    const from = new Date(to.getTime() - days * 86400_000)
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
  }, [range])

  const overviewQuery = trpc.chain.getOverviewKpis.useQuery(
    {
      organizationId: currentOrganizationId!,
      dateFrom: dateWindow.dateFrom,
      dateTo: dateWindow.dateTo,
    },
    { enabled: !!currentOrganizationId },
  )

  const leaderboardQuery = trpc.chain.getLocationLeaderboard.useQuery(
    {
      organizationId: currentOrganizationId!,
      dateFrom: dateWindow.dateFrom,
      dateTo: dateWindow.dateTo,
      sortBy,
      sortDir,
    },
    { enabled: !!currentOrganizationId },
  )

  // No org selected — show an empty state.
  if (!currentOrganizationId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Building2 className="size-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No organization selected</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The chain dashboard rolls up reviews, response rates, and escalations
          across every workspace and location in an organization. Pick or
          create an organization to see the rollup.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/settings">Go to organization settings</Link>
        </Button>
      </div>
    )
  }

  const overview = overviewQuery.data as
    | undefined
    | {
        locationCount: number
        totalReviews: number
        avgRating: number
        responseRate: number
        avgResponseMinutes: number | null
        openEscalations: number
        slaBreachRate: number
        sentimentBreakdown: {
          positive: number
          negative: number
          neutral: number
          mixed: number
        }
      }

  // Shape returned by chain.getLocationLeaderboard:
  //   { locationId, locationName, city, state, workspaceId,
  //     reviews, avgRating, sentimentNet, responseRate,
  //     openEscalations, slaBreachRate }
  const leaderboard = (leaderboardQuery.data ?? []) as Array<{
    locationId: string
    locationName: string
    workspaceId: string
    city: string | null
    state: string | null
    reviews: number
    avgRating: number
    sentimentNet: number
    responseRate: number
    openEscalations: number
    slaBreachRate: number
  }>

  function toggleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir(col === 'avgRating' || col === 'responseRate' ? 'desc' : 'desc')
    }
  }

  function SortIcon({ col }: { col: SortBy }) {
    if (sortBy !== col) {
      return <ArrowUpDown className="ml-1 size-3 inline-block opacity-40" />
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="ml-1 size-3 inline-block" />
    ) : (
      <ChevronDown className="ml-1 size-3 inline-block" />
    )
  }

  // Sentiment breakdown — convert raw counts to percentages.
  const sentiment = overview?.sentimentBreakdown
  const sentimentTotal =
    (sentiment?.positive ?? 0) +
    (sentiment?.negative ?? 0) +
    (sentiment?.neutral ?? 0) +
    (sentiment?.mixed ?? 0)
  const sentimentPct = sentiment
    ? {
        positive: sentimentTotal > 0 ? (sentiment.positive / sentimentTotal) * 100 : 0,
        negative: sentimentTotal > 0 ? (sentiment.negative / sentimentTotal) * 100 : 0,
        neutral: sentimentTotal > 0 ? (sentiment.neutral / sentimentTotal) * 100 : 0,
        mixed: sentimentTotal > 0 ? (sentiment.mixed / sentimentTotal) * 100 : 0,
      }
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="size-6" />
            Chain rollup
          </h1>
          <p className="text-sm text-muted-foreground">
            Aggregated performance across every workspace and location in this
            organization.
          </p>
        </div>

        {/* Date range presets */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                range === r.value
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      {overviewQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-destructive">
            Failed to load KPIs.{' '}
            <button
              className="underline"
              onClick={() => overviewQuery.refetch()}
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            icon={<MapPin className="size-4 text-muted-foreground" />}
            label="Locations"
            value={overview?.locationCount ?? 0}
          />
          <KpiCard
            icon={<MessageSquare className="size-4 text-muted-foreground" />}
            label="Reviews"
            value={overview?.totalReviews ?? 0}
          />
          <KpiCard
            icon={<Star className="size-4 text-amber-500" />}
            label="Avg rating"
            value={fmtRating(overview?.avgRating)}
          />
          <KpiCard
            icon={<Reply className="size-4 text-emerald-600" />}
            label="Response rate"
            value={`${overview?.responseRate ?? 0}%`}
          />
          <KpiCard
            icon={<Clock className="size-4 text-muted-foreground" />}
            label="Avg response"
            value={fmtMinutes(overview?.avgResponseMinutes ?? null)}
          />
          <KpiCard
            icon={<AlertTriangle className="size-4 text-amber-600" />}
            label="Open escalations"
            value={overview?.openEscalations ?? 0}
            sub={
              (overview?.slaBreachRate ?? 0) > 0
                ? `${overview?.slaBreachRate}% SLA breach`
                : undefined
            }
          />
        </div>
      )}

      {/* Sentiment breakdown */}
      {sentimentPct && sentimentTotal > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4" />
              Sentiment breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Across {sentimentTotal} reviews in the selected window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {sentimentPct.positive > 0 && (
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${sentimentPct.positive}%` }}
                  title={`Positive: ${sentiment?.positive}`}
                />
              )}
              {sentimentPct.neutral > 0 && (
                <div
                  className="h-full bg-slate-300"
                  style={{ width: `${sentimentPct.neutral}%` }}
                  title={`Neutral: ${sentiment?.neutral}`}
                />
              )}
              {sentimentPct.mixed > 0 && (
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${sentimentPct.mixed}%` }}
                  title={`Mixed: ${sentiment?.mixed}`}
                />
              )}
              {sentimentPct.negative > 0 && (
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${sentimentPct.negative}%` }}
                  title={`Negative: ${sentiment?.negative}`}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <LegendDot color="bg-emerald-500" label="Positive" value={sentiment?.positive ?? 0} />
              <LegendDot color="bg-slate-300" label="Neutral" value={sentiment?.neutral ?? 0} />
              <LegendDot color="bg-amber-400" label="Mixed" value={sentiment?.mixed ?? 0} />
              <LegendDot color="bg-rose-500" label="Negative" value={sentiment?.negative ?? 0} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Locations leaderboard</CardTitle>
          <CardDescription className="text-xs">
            Click a column header to sort. Click a location to drill into it.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {leaderboardQuery.isLoading ? (
            <div className="space-y-2 px-6 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No location data in this window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 text-left font-medium">
                      Location
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleSort('reviews')}
                    >
                      Reviews
                      <SortIcon col="reviews" />
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleSort('avgRating')}
                    >
                      Avg ★
                      <SortIcon col="avgRating" />
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleSort('responseRate')}
                    >
                      Response %
                      <SortIcon col="responseRate" />
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleSort('openEscalations')}
                    >
                      Open
                      <SortIcon col="openEscalations" />
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleSort('slaBreach')}
                    >
                      SLA breach %
                      <SortIcon col="slaBreach" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, i) => {
                    const cityState = [row.city, row.state]
                      .filter(Boolean)
                      .join(', ')
                    return (
                      <tr
                        key={row.locationId}
                        className={
                          i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                        }
                      >
                        <td className="px-6 py-2.5">
                          <div className="font-medium">{row.locationName}</div>
                          {cityState && (
                            <div className="text-xs text-muted-foreground">
                              {cityState}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.reviews}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {fmtRating(row.avgRating)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.responseRate}%
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.openEscalations > 0 ? (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-700"
                            >
                              {row.openEscalations}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.slaBreachRate > 0 ? (
                            <Badge
                              variant="outline"
                              className="border-rose-300 bg-rose-50 text-rose-700"
                            >
                              {row.slaBreachRate}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0%</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deferred widgets — placeholder so the IA shows the planned shape. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-sm">Geo distribution</CardTitle>
            <CardDescription className="text-xs">
              Map of locations colored by avg rating. Coming next.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Backend ready (chain.getGeoDistribution); UI deferred until the
            mapping library is picked.
          </CardContent>
        </Card>
        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-sm">Response time heatmap</CardTitle>
            <CardDescription className="text-xs">
              Hour-of-day × day-of-week response latency. Coming next.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Backend ready (chain.getResponseTimeHeatmap); UI deferred.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs">{label}</CardDescription>
          {icon}
        </div>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {sub && (
          <p className="text-[11px] text-muted-foreground">{sub}</p>
        )}
      </CardHeader>
    </Card>
  )
}

function LegendDot({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  )
}
