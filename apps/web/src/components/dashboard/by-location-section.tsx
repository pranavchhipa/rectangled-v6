'use client'

/**
 * Hotfix PRD §7 — "By Location" section for the workspace Dashboard.
 *
 * Replaces the deleted `/dashboard/chain` page. Renders only when the
 * current workspace has 2+ locations (single-location workspaces hide
 * the whole section to keep the Dashboard clean).
 *
 * Three widgets, all driven by the same workspace + optional
 * locationIds filter so the dropdown drills all of them in lockstep:
 *   1. LocationsLeaderboard — sortable table per PRD §7.4 columns
 *   2. PerLocationTrends   — multi-line rating-over-time chart
 *   3. GeoDistribution     — locations grouped by city
 *
 * The filter is a multi-select Popover (no existing reusable in shadcn
 * UI components — built inline here). Empty selection = all
 * locations. Selecting a subset narrows the queries.
 */

import { useMemo, useState } from 'react'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  MapPin,
  Star,
  TrendingUp,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Public component ───────────────────────────────────────────────────

export interface LocationOption {
  id: string
  name: string
  city: string | null
  state: string | null
}

export function ByLocationSection({
  workspaceId,
  locations,
}: {
  workspaceId: string
  /** All locations in the workspace, used to populate the filter. */
  locations: LocationOption[]
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Empty selection → undefined → server returns all workspace locations.
  // Non-empty → narrow to subset.
  const locationIdsFilter = selectedIds.length > 0 ? selectedIds : undefined

  return (
    <section className="space-y-4">
      {/* Section divider */}
      <div className="flex items-center justify-between gap-3 border-t pt-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">By Location</h2>
            <p className="text-xs text-muted-foreground">
              Compare performance across {locations.length} locations.
            </p>
          </div>
        </div>
        <LocationFilterPopover
          locations={locations}
          selected={selectedIds}
          onChange={setSelectedIds}
        />
      </div>

      <LocationsLeaderboard
        workspaceId={workspaceId}
        locationIds={locationIdsFilter}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PerLocationTrends
          workspaceId={workspaceId}
          locationIds={locationIdsFilter}
        />
        <GeoDistribution
          workspaceId={workspaceId}
          locationIds={locationIdsFilter}
        />
      </div>
    </section>
  )
}

// ─── Location filter ────────────────────────────────────────────────────

function LocationFilterPopover({
  locations,
  selected,
  onChange,
}: {
  locations: LocationOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.length === 0
  const label = allSelected
    ? `All ${locations.length} locations`
    : selected.length === 1
      ? (locations.find((l) => l.id === selected[0])?.name ?? '1 location')
      : `${selected.length} locations`

  function toggleOne(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
    } else {
      onChange([...selected, id])
    }
  }

  function selectAll() {
    onChange([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="size-4" />
          {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="border-b p-2">
          <button
            type="button"
            onClick={selectAll}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
              allSelected && 'font-medium',
            )}
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded border',
                allSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input',
              )}
            >
              {allSelected && <Check className="size-3" />}
            </span>
            All {locations.length} locations
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {locations.map((loc) => {
            const isOn = selected.includes(loc.id)
            return (
              <label
                key={loc.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={isOn}
                  onCheckedChange={() => toggleOne(loc.id)}
                />
                <span className="min-w-0 flex-1 truncate">{loc.name}</span>
                {(loc.city || loc.state) && (
                  <span className="text-[11px] text-muted-foreground">
                    {[loc.city, loc.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Leaderboard ────────────────────────────────────────────────────────

type LeaderboardSort =
  | 'reviews'
  | 'avgRating'
  | 'sentiment'
  | 'responseRate'
  | 'openEscalations'
  | 'slaBreach'

function LocationsLeaderboard({
  workspaceId,
  locationIds,
}: {
  workspaceId: string
  locationIds?: string[]
}) {
  const [sortBy, setSortBy] = useState<LeaderboardSort>('reviews')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const query = trpc.chain.getLocationLeaderboard.useQuery({
    workspaceId,
    locationIds,
    sortBy,
    sortDir,
  })
  const rows = (query.data ?? []) as Array<{
    locationId: string
    locationName: string
    city: string | null
    state: string | null
    reviews: number
    avgRating: number
    sentimentNet: number
    responseRate: number
    openEscalations: number
    slaBreachRate: number
  }>

  function flipSort(col: LeaderboardSort) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Locations leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No data yet for this filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTh
                  label="Branch"
                  col="reviews"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={() => flipSort('reviews')}
                  // Branch column isn't sorted; left-aligned, leave un-sortable
                  unsortable
                />
                <SortableTh
                  label="Reviews"
                  col="reviews"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={() => flipSort('reviews')}
                  align="right"
                />
                <SortableTh
                  label="Avg ★"
                  col="avgRating"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={() => flipSort('avgRating')}
                  align="right"
                />
                <SortableTh
                  label="Response %"
                  col="responseRate"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={() => flipSort('responseRate')}
                  align="right"
                />
                <SortableTh
                  label="Open Esc"
                  col="openEscalations"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={() => flipSort('openEscalations')}
                  align="right"
                />
                <SortableTh
                  label="SLA breach %"
                  col="slaBreach"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={() => flipSort('slaBreach')}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.locationId}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{r.locationName}</span>
                      {(r.city || r.state) && (
                        <span className="text-[11px] text-muted-foreground">
                          {[r.city, r.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.reviews}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.avgRating > 0 ? r.avgRating.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.reviews > 0 ? `${r.responseRate}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.openEscalations > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-700"
                      >
                        {r.openEscalations}
                      </Badge>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.slaBreachRate > 0 ? (
                      <span
                        className={cn(
                          r.slaBreachRate >= 30
                            ? 'font-semibold text-rose-700'
                            : 'text-amber-700',
                        )}
                      >
                        {r.slaBreachRate}%
                      </span>
                    ) : (
                      '0%'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function SortableTh({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
  align = 'left',
  unsortable,
}: {
  label: string
  col: LeaderboardSort
  sortBy: LeaderboardSort
  sortDir: 'asc' | 'desc'
  onSort: () => void
  align?: 'left' | 'right'
  unsortable?: boolean
}) {
  const isActive = !unsortable && sortBy === col
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      {unsortable ? (
        label
      ) : (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 hover:text-foreground',
            align === 'right' && 'flex-row-reverse',
          )}
        >
          {label}
          {isActive ? (
            sortDir === 'asc' ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )
          ) : (
            <ChevronDown className="size-3 opacity-30" />
          )}
        </button>
      )}
    </TableHead>
  )
}

// ─── Trends chart ───────────────────────────────────────────────────────

const TREND_COLORS = [
  '#2D5BFF',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
]

function PerLocationTrends({
  workspaceId,
  locationIds,
}: {
  workspaceId: string
  locationIds?: string[]
}) {
  const query = trpc.chain.getRatingTrendsByLocation.useQuery({
    workspaceId,
    locationIds,
    granularity: 'week',
  })
  const series = (query.data ?? []) as Array<{
    locationId: string
    name: string
    points: { date: string; avgRating: number; count: number }[]
  }>

  // Pivot the per-series points into a row-per-date shape that Recharts
  // wants for multi-line charts: { date, locA: 4.2, locB: 3.9, ... }
  const chartData = useMemo(() => {
    const dateSet = new Set<string>()
    for (const s of series) for (const p of s.points) dateSet.add(p.date)
    const dates = [...dateSet].sort()
    return dates.map((date) => {
      const row: Record<string, string | number> = { date }
      for (const s of series) {
        const p = s.points.find((pt) => pt.date === date)
        if (p) row[s.locationId] = p.avgRating
      }
      return row
    })
  }, [series])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" />
          Rating trends (weekly)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : series.length === 0 || chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No reviews in the selected window.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    const d = new Date(v)
                    return Number.isFinite(d.getTime())
                      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : v
                  }}
                />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {series.map((s, i) => (
                  <Line
                    key={s.locationId}
                    type="monotone"
                    dataKey={s.locationId}
                    name={s.name}
                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Geo distribution ───────────────────────────────────────────────────

function GeoDistribution({
  workspaceId,
  locationIds,
}: {
  workspaceId: string
  locationIds?: string[]
}) {
  const query = trpc.chain.getGeoDistribution.useQuery({
    workspaceId,
    locationIds,
  })
  const rows = (query.data ?? []) as Array<{
    locationId: string
    name: string
    city: string | null
    state: string | null
    reviewCount: number
    avgRating: number
    sentimentNet: number
  }>

  // Group by city (fallback to state, fallback to "Other").
  const byCity = useMemo(() => {
    const map = new Map<
      string,
      {
        city: string
        locations: typeof rows
        totalReviews: number
      }
    >()
    for (const r of rows) {
      const key = r.city || r.state || 'Other'
      const existing = map.get(key) ?? { city: key, locations: [], totalReviews: 0 }
      existing.locations.push(r)
      existing.totalReviews += r.reviewCount
      map.set(key, existing)
    }
    return [...map.values()].sort((a, b) => b.totalReviews - a.totalReviews)
  }, [rows])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" />
          Geo distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : byCity.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No locations match this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {byCity.map((group) => (
              <div key={group.city} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {group.city}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {group.totalReviews} reviews · {group.locations.length}{' '}
                    location{group.locations.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {group.locations.map((loc) => (
                    <div
                      key={loc.locationId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate">{loc.name}</span>
                      <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="size-3 text-amber-500" />
                          {loc.avgRating > 0 ? loc.avgRating.toFixed(1) : '—'}
                        </span>
                        <span>·</span>
                        <span>{loc.reviewCount} rev</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
