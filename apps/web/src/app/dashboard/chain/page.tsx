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
  Globe,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
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
  const storeOrgId = useAuthStore((s) => s.currentOrganizationId)
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)

  // Fallback: if the org store is empty (still hydrating, or the user
  // never picked an org from the switcher), derive the org from the
  // current workspace. Single-workspace direct-mode users normally never
  // touch the org switcher so the store stays null for them.
  const workspacesQuery = trpc.workspace.list.useQuery(undefined, {
    enabled: !storeOrgId,
  })
  const workspaceOrgId = useMemo(() => {
    if (storeOrgId) return null
    const list = (workspacesQuery.data ?? []) as Array<{
      id: string
      organizationId: string | null
    }>
    const ws =
      list.find((w) => w.id === currentWorkspaceId) ?? list[0]
    return ws?.organizationId ?? null
  }, [storeOrgId, workspacesQuery.data, currentWorkspaceId])

  const currentOrganizationId = storeOrgId ?? workspaceOrgId

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

  // Phase 2 Stage D follow-up — rating trends + geo distribution.
  const trendsQuery = trpc.chain.getRatingTrendsByLocation.useQuery(
    {
      organizationId: currentOrganizationId!,
      dateFrom: dateWindow.dateFrom,
      dateTo: dateWindow.dateTo,
      granularity: 'day',
    },
    { enabled: !!currentOrganizationId },
  )

  const geoQuery = trpc.chain.getGeoDistribution.useQuery(
    {
      organizationId: currentOrganizationId!,
      dateFrom: dateWindow.dateFrom,
      dateTo: dateWindow.dateTo,
    },
    { enabled: !!currentOrganizationId },
  )

  // Resolving the org from the workspace fallback.
  if (!currentOrganizationId && workspacesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // No org found at all (truly: user has no workspace OR workspace has
  // no org_id, which would be a Phase 1 backfill bug).
  if (!currentOrganizationId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Building2 className="size-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No organization yet</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The chain dashboard rolls up reviews, response rates, and escalations
          across every workspace and location in an organization. Create or
          join an organization to see the rollup.
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

      {/* Rating trends chart */}
      <RatingTrendsChart
        data={trendsQuery.data}
        isLoading={trendsQuery.isLoading}
      />

      {/* Geo distribution table */}
      <GeoDistributionTable
        data={geoQuery.data}
        isLoading={geoQuery.isLoading}
      />

      {/* Response time heatmap — still placeholder until UX direction. */}
      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="text-sm">Response time heatmap</CardTitle>
          <CardDescription className="text-xs">
            Hour-of-day × day-of-week response latency. Backend ready
            (chain.getResponseTimeHeatmap); rendering deferred until the
            heatmap visualisation is designed.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

// ─── Rating trends ─────────────────────────────────────────────────────────

const SERIES_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#7c3aed',
  '#0d9488',
]

function RatingTrendsChart({
  data,
  isLoading,
}: {
  data:
    | Array<{
        locationId: string
        name: string
        points: Array<{ date: string; avgRating: number; count: number }>
      }>
    | undefined
  isLoading: boolean
}) {
  // Pivot the per-location point arrays into a flat row-per-date array
  // that Recharts can render as multiple lines (one per location).
  const { rows, locationKeys } = useMemo(() => {
    const series = data ?? []
    const dateSet = new Set<string>()
    for (const s of series) for (const p of s.points) dateSet.add(p.date)
    const dates = Array.from(dateSet).sort()
    const keys = series.map((s) => ({
      key: s.locationId,
      name: s.name || s.locationId.slice(0, 8),
    }))
    const rows = dates.map((d) => {
      const row: Record<string, string | number> = { date: d }
      for (const s of series) {
        const point = s.points.find((p) => p.date === d)
        if (point) row[s.locationId] = point.avgRating
      }
      return row
    })
    return { rows, locationKeys: keys }
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="size-4" />
          Rating trends
        </CardTitle>
        <CardDescription className="text-xs">
          Daily avg rating per location. Top 10 locations by review volume
          when no explicit selection.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No reviews in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rows} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => {
                  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d)
                  return m ? `${m[1]}/${m[2]}` : d
                }}
              />
              <YAxis
                domain={[0, 5]}
                tick={{ fontSize: 11 }}
                width={28}
                allowDecimals
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number) => v.toFixed(2)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {locationKeys.slice(0, 10).map((loc, i) => (
                <Line
                  key={loc.key}
                  type="monotone"
                  dataKey={loc.key}
                  name={loc.name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Geo distribution ──────────────────────────────────────────────────────

function GeoDistributionTable({
  data,
  isLoading,
}: {
  data:
    | Array<{
        locationId: string
        name: string
        city: string | null
        state: string | null
        reviewCount: number
        avgRating: number
        sentimentNet: number
      }>
    | undefined
  isLoading: boolean
}) {
  // Group by city/state — the cheapest "geo" view without a real map.
  const cityRows = useMemo(() => {
    const byCity = new Map<
      string,
      {
        city: string
        state: string
        locationCount: number
        reviews: number
        ratingSum: number
      }
    >()
    for (const row of data ?? []) {
      if (!row.city) continue
      const key = `${row.city}|${row.state ?? ''}`
      let bucket = byCity.get(key)
      if (!bucket) {
        bucket = {
          city: row.city,
          state: row.state ?? '',
          locationCount: 0,
          reviews: 0,
          ratingSum: 0,
        }
        byCity.set(key, bucket)
      }
      bucket.locationCount += 1
      bucket.reviews += row.reviewCount
      // Weight avg rating by review count so a city with a high-volume
      // location dominates over a city with a single 5-review location.
      bucket.ratingSum += row.avgRating * row.reviewCount
    }
    return Array.from(byCity.values())
      .map((b) => ({
        ...b,
        avgRating: b.reviews > 0 ? b.ratingSum / b.reviews : 0,
      }))
      .sort((a, b) => b.reviews - a.reviews)
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="size-4" />
          Geo distribution
        </CardTitle>
        <CardDescription className="text-xs">
          Locations grouped by city. A real map view (Mapbox / Leaflet)
          plus lat/lng on the locations table is the next step.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="space-y-2 px-6 pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : cityRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No locations with city data in this window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-6 py-2 text-left font-medium">City</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Locations
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Reviews</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Weighted ★
                  </th>
                </tr>
              </thead>
              <tbody>
                {cityRows.map((c, i) => (
                  <tr
                    key={`${c.city}-${c.state}`}
                    className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                  >
                    <td className="px-6 py-2 font-medium">
                      {c.city}
                      {c.state && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {c.state}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.locationCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.reviews}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.avgRating.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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
