'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Star,
  MessageSquare,
  ThumbsUp,
  Heart,
  Users,
  Shield,
  Download,
  Loader2,
} from 'lucide-react'
// Dynamic imports for PDF generation (avoid SSR/webpack issues)
const loadPdfLibs = async () => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])
  return { html2canvas, jsPDF }
}
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { InfoTooltip } from '@/components/ui/info-tooltip'

// -- Existing chart components (recharts-based) --
import { HealthScoreCard } from '@/components/analytics/health-score-card'
import { RatingDistributionChart } from '@/components/analytics/rating-distribution-chart'
import { ReviewVelocityChart } from '@/components/analytics/review-velocity-chart'
import { SentimentChart } from '@/components/analytics/sentiment-chart'
import { PlatformComparisonChart } from '@/components/analytics/platform-comparison-chart'
import { RatingTrendChart } from '@/components/analytics/rating-trend-chart'
import { ResponseRateCard } from '@/components/analytics/response-rate-card'
import { TopThemesChart } from '@/components/analytics/top-themes-chart'

// -- New chart components (pure CSS/SVG) --
import { SourceDonutChart } from '@/components/analytics/source-donut-chart'
import { AspectPerformanceChart } from '@/components/analytics/aspect-performance-chart'
import { SentimentTrendChart } from '@/components/analytics/sentiment-trend-chart'
import { NevEmotionWheel } from '@/components/analytics/nev-emotion-wheel'
import { CliSegmentChart } from '@/components/analytics/cli-segment-chart'

// Date range and platform filter state are managed inside the component

// ─── Skeleton loaders ───
function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="space-y-4 pt-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

function AnalyticsSkeletons() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <Card>
        <CardContent className="flex items-center gap-8 py-8 px-10">
          <Skeleton className="size-[148px] shrink-0 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-72" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

// ─── KPI Card Component ───
function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  trendLabel?: string
  icon: React.ElementType
  color: string
}) {
  const isPositive = (trend ?? 0) >= 0
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color }} />
          </div>
          {trend !== undefined && (
            <div
              className={`flex items-center gap-0.5 text-xs font-medium ${
                isPositive ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend > 0 ? '+' : ''}
              {trend}%
            </div>
          )}
          {!trend && trendLabel && (
            <Badge variant="secondary" className="text-[10px]">
              {trendLabel}
            </Badge>
          )}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Star rating display ───
function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Main Analytics Page ───
export default function AnalyticsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const analyticsRef = useRef<HTMLDivElement>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(Date.now() - 30 * 86400000),
    to: new Date(),
  })
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [locationId, setLocationId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch locations for filter
  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Fetch analytics data
  const analyticsQuery = trpc.review.analytics.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      dateRange: 'custom',
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      locationId: locationId !== 'all' ? locationId : undefined,
    },
    { enabled: !!currentWorkspaceId }
  )

  // NEV analytics
  const nevQuery = trpc.nev.getAnalytics.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      locationId: locationId !== 'all' ? locationId : undefined,
    },
    { enabled: !!currentWorkspaceId }
  )

  // CLI analytics
  const cliQuery = trpc.cli.getAnalytics.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      locationId: locationId !== 'all' ? locationId : undefined,
    },
    { enabled: !!currentWorkspaceId }
  )

  // CLI segments
  const cliSegmentsQuery = trpc.cli.getSegments.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      locationId: locationId !== 'all' ? locationId : undefined,
    },
    { enabled: !!currentWorkspaceId }
  )

  const analytics = analyticsQuery.data
  const locations = locationsQuery.data ?? []
  const isLoading = analyticsQuery.isLoading
  const nevData = nevQuery.data as any
  const cliData = cliQuery.data as any
  const cliSegments = cliSegmentsQuery.data as any

  const hasData =
    analytics &&
    (analytics.ratingDistribution.length > 0 ||
      analytics.reviewVelocity.length > 0 ||
      analytics.sentimentBreakdown.length > 0)

  // Compute derived KPI values
  const totalReviews = useMemo(() => {
    if (!analytics) return 0
    return analytics.ratingDistribution.reduce(
      (sum: number, d: any) => sum + d.count,
      0
    )
  }, [analytics])

  const avgRating = useMemo(() => {
    if (!analytics || analytics.ratingDistribution.length === 0) return 0
    const total = analytics.ratingDistribution.reduce(
      (sum: number, d: any) => sum + d.count,
      0
    )
    const weighted = analytics.ratingDistribution.reduce(
      (sum: number, d: any) => sum + d.rating * d.count,
      0
    )
    return total > 0 ? weighted / total : 0
  }, [analytics])

  const responseRate = analytics?.responseRate?.rate ?? 0

  const nevScore = useMemo(() => {
    if (!nevData) return null
    return nevData.overallScore ?? nevData.nevScore ?? null
  }, [nevData])

  const cliScore = useMemo(() => {
    if (!cliData) return null
    return cliData.overallScore ?? cliData.cliScore ?? null
  }, [cliData])

  const getCliLabel = (score: number | null) => {
    if (score === null) return 'N/A'
    if (score >= 8) return 'Champion'
    if (score >= 6) return 'Loyalist'
    if (score >= 4) return 'Passive'
    if (score >= 2) return 'At-Risk'
    return 'Detractor'
  }

  const getCliColor = (score: number | null) => {
    if (score === null) return '#6B7280'
    if (score >= 8) return '#047857'
    if (score >= 6) return '#10B981'
    if (score >= 4) return '#F59E0B'
    if (score >= 2) return '#F97316'
    return '#EF4444'
  }

  const generatePDF = useCallback(async () => {
    const element = analyticsRef.current
    if (!element) return

    setIsGeneratingPdf(true)
    toast.info('Generating PDF... please wait.')

    try {
      // Temporarily show all tab contents for a full capture
      const tabPanels = element.querySelectorAll<HTMLElement>('[role="tabpanel"]')
      const originalStates = new Map<HTMLElement, { display: string; hidden: boolean }>()

      tabPanels.forEach((panel) => {
        originalStates.set(panel, {
          display: panel.style.display,
          hidden: panel.hidden,
        })
        panel.style.display = 'block'
        panel.hidden = false
        panel.removeAttribute('data-state')
        panel.setAttribute('data-state', 'active')
      })

      // Hide the TabsList (tab buttons) during capture so it looks cleaner
      const tabsList = element.querySelector<HTMLElement>('[role="tablist"]')
      let tabsListOriginalDisplay = ''
      if (tabsList) {
        tabsListOriginalDisplay = tabsList.style.display
        tabsList.style.display = 'none'
      }

      // Small delay to let the DOM update
      await new Promise((r) => setTimeout(r, 300))

      const { html2canvas, jsPDF } = await loadPdfLibs()
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1400,
      })

      // Restore original tab states
      tabPanels.forEach((panel) => {
        const original = originalStates.get(panel)
        if (original) {
          panel.style.display = original.display
          panel.hidden = original.hidden
        }
      })
      if (tabsList) {
        tabsList.style.display = tabsListOriginalDisplay
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF('landscape', 'mm', 'a4')

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      // Header
      pdf.setFontSize(20)
      pdf.setTextColor(79, 70, 229)
      pdf.text('Rectangled.io - Analytics Report', 14, 15)
      pdf.setFontSize(10)
      pdf.setTextColor(107, 114, 128)

      const fromStr = dateRange.from
        ? dateRange.from.toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : ''
      const toStr = dateRange.to
        ? dateRange.to.toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : ''
      pdf.text(
        `Period: ${fromStr} - ${toStr}  |  Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
        14,
        22,
      )

      // Separator line
      pdf.setDrawColor(229, 231, 235)
      pdf.setLineWidth(0.5)
      pdf.line(14, 25, pdfWidth - 14, 25)

      // Calculate image dimensions
      const imgWidth = pdfWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const headerOffset = 30
      const usablePageHeight = pdfHeight - headerOffset - 10 // 10mm bottom margin

      let heightLeft = imgHeight
      let position = headerOffset

      // First page
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight)
      heightLeft -= usablePageHeight

      // Add remaining pages if content overflows
      while (heightLeft > 0) {
        pdf.addPage()
        position = -(imgHeight - heightLeft) + 10
        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
      }

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(156, 163, 175)
        pdf.text(
          `Page ${i} of ${totalPages}  |  Rectangled.io`,
          pdfWidth / 2,
          pdfHeight - 5,
          { align: 'center' },
        )
      }

      pdf.save(
        `rectangled-analytics-${new Date().toISOString().split('T')[0]}.pdf`,
      )
      toast.success('PDF downloaded successfully!')
    } catch (err) {
      console.error('PDF generation failed:', err)
      toast.error('Failed to generate PDF. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [dateRange])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Insights and trends across your review data.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              presets={['7d', '14d', '30d', '90d', 'all']}
            />
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="zomato">Zomato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc: any) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasData && (
            <Button
              onClick={generatePDF}
              disabled={isGeneratingPdf}
              variant="outline"
              className="gap-1.5"
            >
              {isGeneratingPdf ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <AnalyticsSkeletons />}

      {/* Empty state */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <BarChart3 className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No analytics data yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Analytics will appear here once reviews are synced from your
            connected platforms.
          </p>
        </div>
      )}

      {/* Analytics content */}
      {!isLoading && hasData && analytics && (
        <div ref={analyticsRef} className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              title="Total Reviews"
              value={totalReviews.toLocaleString()}
              icon={MessageSquare}
              color="#3B82F6"
              trend={12}
            />
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10">
                    <Star className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <StarRatingDisplay rating={avgRating} />
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {avgRating.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Average Rating
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-500/10">
                    <ThumbsUp className="w-4.5 h-4.5 text-purple-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {Math.round(responseRate)}%
                </p>
                <div className="mt-1.5 w-full bg-muted rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all bg-purple-500"
                    style={{ width: `${Math.min(responseRate, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Response Rate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-500/10">
                    <Heart className="w-4.5 h-4.5 text-rose-500" />
                  </div>
                </div>
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{
                    color:
                      nevScore !== null
                        ? nevScore >= 0
                          ? '#10B981'
                          : '#EF4444'
                        : undefined,
                  }}
                >
                  {nevScore !== null ? nevScore.toFixed(1) : '--'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  NEV Score
                  <InfoTooltip text="Net Emotional Value — positive vs negative emotion ratio (-100 to +100)" />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/10">
                    <Shield className="w-4.5 h-4.5 text-emerald-500" />
                  </div>
                  <Badge
                    className="text-[10px]"
                    style={{
                      backgroundColor: `${getCliColor(cliScore)}20`,
                      color: getCliColor(cliScore),
                      borderColor: 'transparent',
                    }}
                  >
                    {getCliLabel(cliScore)}
                  </Badge>
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {cliScore !== null ? cliScore.toFixed(1) : '--'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  CLI Score
                  <InfoTooltip text="Customer Loyalty Index — trust + satisfaction + advocacy composite (0-100)" />
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Health Score */}
          <HealthScoreCard score={analytics.healthScore} />

          {/* Tabs for detail views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="aspects">Aspects</TabsTrigger>
              <TabsTrigger value="sentiment">Sentiment & NEV</TabsTrigger>
              <TabsTrigger value="loyalty">Loyalty & CLI</TabsTrigger>
            </TabsList>

            {/* ─── Overview Tab ─── */}
            <TabsContent value="overview">
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <ReviewVelocityChart data={analytics.reviewVelocity} />
                <RatingDistributionChart data={analytics.ratingDistribution} />
                <SourceDonutChart
                  data={analytics.platformComparison ?? []}
                />
                <AspectPerformanceChart
                  data={analytics.topThemes ?? []}
                />
                <SentimentChart
                  data={analytics.sentimentBreakdown.filter(
                    (s): s is { sentiment: string; count: number } =>
                      s.sentiment !== null
                  )}
                />
                <RatingTrendChart data={analytics.ratingTrend} />
                <PlatformComparisonChart data={analytics.platformComparison} />
                <ResponseRateCard data={analytics.responseRate} />
              </div>
            </TabsContent>

            {/* ─── Aspects Tab ─── */}
            <TabsContent value="aspects">
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <AspectPerformanceChart
                  data={analytics.topThemes ?? []}
                  detailed
                />
                <TopThemesChart data={analytics.topThemes} />
                <RatingDistributionChart data={analytics.ratingDistribution} />
                <RatingTrendChart data={analytics.ratingTrend} />
              </div>
            </TabsContent>

            {/* ─── Sentiment & NEV Tab ─── */}
            <TabsContent value="sentiment">
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <SentimentChart
                  data={analytics.sentimentBreakdown.filter(
                    (s): s is { sentiment: string; count: number } =>
                      s.sentiment !== null
                  )}
                />
                <SentimentTrendChart data={analytics.ratingTrend} />
                <NevEmotionWheel data={nevData} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <span className="flex items-center gap-1.5">
                        NEV Score Summary
                        <InfoTooltip text="Net Emotional Value — positive vs negative emotion ratio (-100 to +100)" />
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-32 h-32">
                        <svg viewBox="0 0 120 120" className="w-full h-full">
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-muted/30"
                          />
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill="none"
                            stroke={
                              nevScore !== null && nevScore >= 0
                                ? '#10B981'
                                : '#EF4444'
                            }
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 50}`}
                            strokeDashoffset={`${
                              2 * Math.PI * 50 * (1 - Math.abs(nevScore ?? 0) / 100)
                            }`}
                            className="-rotate-90 origin-center transition-all duration-700"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span
                            className="text-3xl font-bold"
                            style={{
                              color:
                                nevScore !== null && nevScore >= 0
                                  ? '#10B981'
                                  : '#EF4444',
                            }}
                          >
                            {nevScore !== null ? nevScore.toFixed(0) : '--'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            NEV
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                        Net Emotional Value measures the emotional impact of
                        customer experiences across all touchpoints.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ─── Loyalty & CLI Tab ─── */}
            <TabsContent value="loyalty">
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <CliSegmentChart data={cliSegments} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <span className="flex items-center gap-1.5">
                        CLI Score Overview
                        <InfoTooltip text="Customer Loyalty Index — trust + satisfaction + advocacy composite (0-100)" />
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className="text-5xl font-bold"
                        style={{ color: getCliColor(cliScore) }}
                      >
                        {cliScore !== null ? cliScore.toFixed(1) : '--'}
                      </div>
                      <Badge
                        className="text-sm px-3 py-1"
                        style={{
                          backgroundColor: `${getCliColor(cliScore)}20`,
                          color: getCliColor(cliScore),
                          borderColor: 'transparent',
                        }}
                      >
                        {getCliLabel(cliScore)}
                      </Badge>
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                        Customer Loyalty Index combines trust, satisfaction, and
                        advocacy metrics into a single loyalty score.
                      </p>
                      <div className="w-full space-y-2 mt-2">
                        {[
                          {
                            label: 'Trust',
                            value: cliData?.avgTrust ?? 0,
                            color: '#3B82F6',
                          },
                          {
                            label: 'Satisfaction',
                            value: cliData?.avgSatisfaction ?? 0,
                            color: '#10B981',
                          },
                          {
                            label: 'Advocacy',
                            value: cliData?.avgAdvocacy ?? 0,
                            color: '#8B5CF6',
                          },
                        ].map((metric) => (
                          <div key={metric.label} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {metric.label}
                              </span>
                              <span className="font-medium">
                                {metric.value.toFixed(1)}/10
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${(metric.value / 10) * 100}%`,
                                  backgroundColor: metric.color,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <ResponseRateCard data={analytics.responseRate} />
                <PlatformComparisonChart data={analytics.platformComparison} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ─── Report History ─── */}
      <ReportHistorySection workspaceId={currentWorkspaceId} />
    </div>
  )
}

// ─── Report History Section ───────────────────────────────────

function ReportHistorySection({ workspaceId }: { workspaceId: string | null }) {
  const queryClient = useQueryClient()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [reportType, setReportType] = useState('orm_overview')

  const reportsQuery = trpc.report?.list?.useQuery?.(
    { workspaceId: workspaceId!, membershipId: workspaceId!, page: 1, limit: 10 },
    { enabled: !!workspaceId }
  )

  const generateMutation = trpc.report?.generate?.useMutation?.({
    onSuccess: () => {
      toast.success('Report generated successfully!')
      reportsQuery?.refetch?.()
      setGenerateOpen(false)
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to generate report'),
  })

  const deleteMutation = trpc.report?.delete?.useMutation?.({
    onSuccess: () => {
      toast.success('Report deleted')
      reportsQuery?.refetch?.()
    },
  })

  const exportPdfMutation = trpc.report?.exportPdf?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.pdf) {
        const link = document.createElement('a')
        link.href = `data:application/pdf;base64,${data.pdf}`
        link.download = 'report.pdf'
        link.click()
        toast.success('PDF downloaded')
      }
    },
  })

  const reports = (reportsQuery?.data as any)?.data ?? reportsQuery?.data ?? []

  const REPORT_TYPES = [
    { value: 'orm_overview', label: 'ORM Overview' },
    { value: 'aspect_analysis', label: 'Aspect Analysis' },
    { value: 'truforms_feedback', label: 'TruForms Feedback' },
    { value: 'journey_analytics', label: 'Journey Analytics' },
    { value: 'nev_report', label: 'NEV Report' },
    { value: 'cli_report', label: 'CLI Report' },
  ]

  return (
    <div className="space-y-4 mt-8 border-t pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="size-5" />
            Report History
          </h2>
          <p className="text-sm text-muted-foreground">Generate and download reports</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <BarChart3 className="size-4 mr-1" />
          Generate Report
        </Button>
      </div>

      {/* Generate dialog */}
      {generateOpen && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Report Type</span>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (!workspaceId) return
                generateMutation?.mutate?.({
                  workspaceId,
                  membershipId: workspaceId,
                  reportType: reportType as any,
                  dateFrom: new Date(Date.now() - 30 * 86400000).toISOString(),
                  dateTo: new Date().toISOString(),
                })
              }}
              disabled={generateMutation?.isPending}
            >
              {generateMutation?.isPending ? 'Generating...' : 'Generate'}
            </Button>
            <Button variant="ghost" onClick={() => setGenerateOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Reports list */}
      {Array.isArray(reports) && reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map((report: any) => (
            <Card key={report.id} className="p-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs shrink-0">
                  {REPORT_TYPES.find((t) => t.value === report.reportType)?.label ?? report.reportType}
                </Badge>
                <span className="text-sm font-medium truncate">{report.title}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => exportPdfMutation?.mutate?.({ workspaceId: workspaceId!, membershipId: workspaceId!, reportId: report.id })}
                  disabled={exportPdfMutation?.isPending}
                >
                  PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive shrink-0"
                  onClick={() => deleteMutation?.mutate?.({ workspaceId: workspaceId!, membershipId: workspaceId!, reportId: report.id })}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No reports generated yet. Click "Generate Report" to create one.</p>
        </Card>
      )}
    </div>
  )
}
