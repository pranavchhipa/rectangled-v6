'use client'

/**
 * v2 Journey Builder
 *
 * One journey = one `metric_question` screen. The customer sees ONE randomly
 * picked metric (CSAT, NPS, CES, NEV, or CLI) per visit. Owners edit:
 *   - which metrics are enabled (toggles)
 *   - per-metric thresholds (when does a score count as positive?)
 *   - per-metric question + scale labels
 *   - aspect tags for the unhappy path
 *   - happy-path Yes/No copy + redirect URLs
 *   - review template (auto-copied to clipboard before Google redirect)
 *   - thank-you copy for each branch (happy yes / happy no / unhappy)
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Save,
  Eye,
  QrCode,
  Power,
  MapPin,
  Plus,
  X,
  Download,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type Metric = 'csat' | 'nps' | 'ces' | 'nev' | 'cli'
type ReviewPlatform = 'google' | 'zomato' | 'swiggy'

interface MetricCopy {
  question: string
  scaleLabels: { low: string; high: string }
}

interface MetricQuestionConfig {
  metricCopy: Record<Metric, MetricCopy>
  aspectTags: string[]
  feedbackPlaceholder: string
  reviewPromptCopy: { question: string; yesLabel: string; noLabel: string }
  redirectLinks: { google?: string; zomato?: string; swiggy?: string }
  reviewTemplate: string
  thankYouHappyYes: string
  thankYouHappyNo: string
  thankYouUnhappy: string
}

interface JourneySettings {
  enabledMetrics: Metric[]
  thresholds: Record<Metric, number>
  enableCoupon: boolean
  reviewPlatform: ReviewPlatform
}

const METRIC_LABELS: Record<Metric, { name: string; range: string; note: string }> = {
  csat: { name: 'CSAT', range: '1–5', note: 'Customer satisfaction' },
  nps: { name: 'NPS', range: '0–10', note: 'Net Promoter (promoters only ≥ threshold)' },
  ces: { name: 'CES', range: '1–7', note: 'Customer Effort — LOWER is better' },
  nev: { name: 'NEV', range: '-100 to +100', note: 'Net Emotional Value' },
  cli: { name: 'CLI', range: '1–7', note: 'Customer Loyalty Index' },
}

const METRIC_RANGES: Record<Metric, { min: number; max: number }> = {
  csat: { min: 1, max: 5 },
  nps: { min: 0, max: 10 },
  ces: { min: 1, max: 7 },
  nev: { min: -100, max: 100 },
  cli: { min: 1, max: 7 },
}

const ALL_METRICS: Metric[] = ['csat', 'nps', 'ces', 'nev', 'cli']

const DEFAULT_METRIC_COPY: Record<Metric, MetricCopy> = {
  csat: {
    question: 'How satisfied are you with your experience?',
    scaleLabels: { low: 'Very unsatisfied', high: 'Very satisfied' },
  },
  nps: {
    question: 'How likely are you to recommend us to a friend?',
    scaleLabels: { low: 'Not at all likely', high: 'Extremely likely' },
  },
  ces: {
    question: 'How easy was it to get what you needed today?',
    scaleLabels: { low: 'Very easy', high: 'Very difficult' },
  },
  nev: {
    question: 'How did your experience make you feel?',
    scaleLabels: { low: 'Very negative', high: 'Very positive' },
  },
  cli: {
    question: 'How likely are you to keep choosing us in the future?',
    scaleLabels: { low: 'Not likely at all', high: 'Extremely likely' },
  },
}

const DEFAULT_CONFIG: MetricQuestionConfig = {
  metricCopy: DEFAULT_METRIC_COPY,
  aspectTags: ['Food quality', 'Service', 'Cleanliness', 'Wait time', 'Value', 'Staff'],
  feedbackPlaceholder: 'Tell us what went wrong, in your own words.',
  reviewPromptCopy: {
    question: 'Would you mind leaving us a review?',
    yesLabel: 'Sure',
    noLabel: 'Maybe later',
  },
  redirectLinks: {},
  reviewTemplate: 'Had a great experience at {businessName}!',
  thankYouHappyYes: 'Thank you! Opening the review page now.',
  thankYouHappyNo: 'Thanks for your time!',
  thankYouUnhappy: "Thank you for the feedback. We'll work on it.",
}

const DEFAULT_THRESHOLDS: Record<Metric, number> = {
  csat: 4,
  nps: 9,
  ces: 3,
  nev: 0,
  cli: 5,
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function JourneyBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const journeyId = params.id as string
  const utils = trpc.useUtils()
  const { currentWorkspaceId } = useAuthStore()

  const journeyQuery = trpc.journey.getById.useQuery(
    { id: journeyId },
    { enabled: !!journeyId },
  )
  const journey = journeyQuery.data

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )
  const locations = locationsQuery.data ?? []

  const updateJourneyMutation = trpc.journey.update.useMutation({
    onSuccess: () => {
      utils.journey.getById.invalidate({ id: journeyId })
    },
    onError: (e) => toast.error(e.message || 'Failed to update'),
  })

  const updateScreensMutation = trpc.journey.updateScreens.useMutation({
    onSuccess: () => {
      toast.success('Saved')
      utils.journey.getById.invalidate({ id: journeyId })
      setHasChanges(false)
    },
    onError: (e) => toast.error(e.message || 'Failed to save'),
  })

  // ===== Local state =====
  const [config, setConfig] = useState<MetricQuestionConfig>(DEFAULT_CONFIG)
  const [settings, setSettings] = useState<JourneySettings>({
    enabledMetrics: [...ALL_METRICS],
    thresholds: { ...DEFAULT_THRESHOLDS },
    enableCoupon: false,
    reviewPlatform: 'google',
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [activeMetric, setActiveMetric] = useState<Metric>('csat')
  const [aspectInput, setAspectInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [journeyName, setJourneyName] = useState('')
  const [qrOpen, setQrOpen] = useState(false)

  // Hydrate from server.
  useEffect(() => {
    if (!journeyQuery.data) return
    const j: any = journeyQuery.data
    const screen = (j.screens ?? []).find((s: any) => s.screenType === 'metric_question')
    if (screen?.config) {
      const c = screen.config as Partial<MetricQuestionConfig>
      setConfig({
        metricCopy: { ...DEFAULT_METRIC_COPY, ...(c.metricCopy ?? {}) },
        aspectTags: c.aspectTags ?? DEFAULT_CONFIG.aspectTags,
        feedbackPlaceholder: c.feedbackPlaceholder ?? DEFAULT_CONFIG.feedbackPlaceholder,
        reviewPromptCopy: {
          ...DEFAULT_CONFIG.reviewPromptCopy,
          ...(c.reviewPromptCopy ?? {}),
        },
        redirectLinks: c.redirectLinks ?? {},
        reviewTemplate: c.reviewTemplate ?? DEFAULT_CONFIG.reviewTemplate,
        thankYouHappyYes: c.thankYouHappyYes ?? DEFAULT_CONFIG.thankYouHappyYes,
        thankYouHappyNo: c.thankYouHappyNo ?? DEFAULT_CONFIG.thankYouHappyNo,
        thankYouUnhappy: c.thankYouUnhappy ?? DEFAULT_CONFIG.thankYouUnhappy,
      })
    }
    const s = (j.settings ?? {}) as Partial<JourneySettings>
    setSettings({
      enabledMetrics: s.enabledMetrics?.length ? (s.enabledMetrics as Metric[]) : [...ALL_METRICS],
      thresholds: { ...DEFAULT_THRESHOLDS, ...(s.thresholds ?? {}) },
      enableCoupon: s.enableCoupon ?? false,
      reviewPlatform: (s.reviewPlatform as ReviewPlatform) ?? 'google',
    })
    setJourneyName(j.name ?? '')
    setHasChanges(false)
  }, [journeyQuery.data])

  // ===== Actions =====
  function patchConfig(patch: Partial<MetricQuestionConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }))
    setHasChanges(true)
  }
  function patchMetricCopy(metric: Metric, patch: Partial<MetricCopy>) {
    setConfig((prev) => ({
      ...prev,
      metricCopy: {
        ...prev.metricCopy,
        [metric]: { ...prev.metricCopy[metric], ...patch },
      },
    }))
    setHasChanges(true)
  }
  function patchSettings(patch: Partial<JourneySettings>) {
    setSettings((prev) => ({ ...prev, ...patch }))
    setHasChanges(true)
  }
  function toggleMetric(metric: Metric) {
    setSettings((prev) => {
      const has = prev.enabledMetrics.includes(metric)
      const next = has
        ? prev.enabledMetrics.filter((m) => m !== metric)
        : [...prev.enabledMetrics, metric]
      // Don't allow disabling the last metric.
      return { ...prev, enabledMetrics: next.length === 0 ? prev.enabledMetrics : next }
    })
    setHasChanges(true)
  }
  function setThreshold(metric: Metric, value: number) {
    setSettings((prev) => ({ ...prev, thresholds: { ...prev.thresholds, [metric]: value } }))
    setHasChanges(true)
  }

  function addAspect() {
    const v = aspectInput.trim()
    if (!v) return
    if (config.aspectTags.includes(v)) {
      setAspectInput('')
      return
    }
    patchConfig({ aspectTags: [...config.aspectTags, v] })
    setAspectInput('')
  }
  function removeAspect(tag: string) {
    patchConfig({ aspectTags: config.aspectTags.filter((t) => t !== tag) })
  }

  async function handleSave() {
    if (!journey) return
    // Persist settings first, then the screen config.
    await updateJourneyMutation.mutateAsync({
      id: journeyId,
      settings,
    })
    await updateScreensMutation.mutateAsync({
      journeyId,
      screens: [
        {
          order: 0,
          screenType: 'metric_question',
          title: 'How was your experience?',
          subtitle: undefined,
          config: config as unknown as Record<string, unknown>,
          branchConditions: [],
        },
      ],
    })
  }

  function handleSaveName() {
    if (!journeyName.trim()) return
    updateJourneyMutation.mutate(
      { id: journeyId, name: journeyName.trim() },
      {
        onSuccess: () => {
          toast.success('Name updated')
          setEditingName(false)
        },
      },
    )
  }

  function copyPublicLink() {
    if (!journey?.slug) return
    const url = `${window.location.origin}/j/${journey.slug}`
    navigator.clipboard.writeText(url)
    toast.success('Public link copied')
  }

  // ===== Render =====
  if (journeyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (!journey) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Journey not found.</p>
        <Button variant="link" onClick={() => router.push('/dashboard/journeys')}>
          Back to Journeys
        </Button>
      </div>
    )
  }

  const journeyAny = journey as any

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/journeys')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-base font-semibold"
                  value={journeyName}
                  onChange={(e) => setJourneyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') {
                      setJourneyName(journey.name ?? '')
                      setEditingName(false)
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName}>
                  Save
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="text-xl font-bold hover:underline"
                onClick={() => setEditingName(true)}
              >
                {journey.name}
              </button>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <code className="text-xs text-muted-foreground">/j/{journey.slug}</code>
              <Badge variant={journey.isActive ? 'default' : 'secondary'} className="text-[10px]">
                {journey.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {/* Location selector */}
              <Select
                value={journeyAny.locationId || 'none'}
                onValueChange={(val) => {
                  const newLocId = val === 'none' ? null : val
                  updateJourneyMutation.mutate({ id: journeyId, locationId: newLocId })
                }}
              >
                <SelectTrigger className="h-6 w-auto gap-1 text-xs border-dashed px-2">
                  <MapPin className="size-3" />
                  <SelectValue placeholder="No location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location</SelectItem>
                  {locations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyPublicLink}>
            <Copy className="size-3.5" />
            Copy Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/j/${journey.slug}`, '_blank')}
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="size-3.5" />
            QR
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateJourneyMutation.mutate(
                { id: journeyId, isActive: !journey.isActive },
                {
                  onSuccess: () => toast.success(journey.isActive ? 'Deactivated' : 'Activated'),
                },
              )
            }
          >
            <Power className="size-3.5" />
            {journey.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateScreensMutation.isPending}>
            <Save className="size-4" />
            {updateScreensMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="settings">Metrics & Routing</TabsTrigger>
          <TabsTrigger value="redirects">Redirects & Copy</TabsTrigger>
        </TabsList>

        {/* ====================================================== */}
        {/*                  Tab 1: Builder                          */}
        {/* ====================================================== */}
        <TabsContent value="builder" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left: Editor */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Metric question
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                    <p>
                      Each visitor sees ONE randomly-picked metric from your enabled list. Edit
                      the question + labels for each metric below — the customer only sees one.
                    </p>
                    <p className="font-medium">
                      Currently enabled:{' '}
                      {settings.enabledMetrics.map((m) => METRIC_LABELS[m].name).join(', ')}
                    </p>
                  </div>

                  <Tabs value={activeMetric} onValueChange={(v) => setActiveMetric(v as Metric)}>
                    <TabsList className="grid grid-cols-5 w-full">
                      {ALL_METRICS.map((m) => (
                        <TabsTrigger
                          key={m}
                          value={m}
                          className={
                            settings.enabledMetrics.includes(m) ? '' : 'opacity-50'
                          }
                        >
                          {METRIC_LABELS[m].name}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {ALL_METRICS.map((m) => (
                      <TabsContent key={m} value={m} className="space-y-3 mt-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Question</Label>
                          <Input
                            value={config.metricCopy[m].question}
                            onChange={(e) => patchMetricCopy(m, { question: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">
                              Low end label (score = {METRIC_RANGES[m].min})
                            </Label>
                            <Input
                              value={config.metricCopy[m].scaleLabels.low}
                              onChange={(e) =>
                                patchMetricCopy(m, {
                                  scaleLabels: {
                                    ...config.metricCopy[m].scaleLabels,
                                    low: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">
                              High end label (score = {METRIC_RANGES[m].max})
                            </Label>
                            <Input
                              value={config.metricCopy[m].scaleLabels.high}
                              onChange={(e) =>
                                patchMetricCopy(m, {
                                  scaleLabels: {
                                    ...config.metricCopy[m].scaleLabels,
                                    high: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{METRIC_LABELS[m].note}</p>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Unhappy path — aspect tags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Customers below threshold tap one or more of these to tell you what went
                    wrong.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {config.aspectTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        {tag}
                        <button
                          type="button"
                          className="hover:bg-muted rounded-sm p-0.5"
                          onClick={() => removeAspect(tag)}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an aspect, e.g. 'Pricing'"
                      value={aspectInput}
                      onChange={(e) => setAspectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addAspect()
                        }
                      }}
                    />
                    <Button size="sm" onClick={addAspect}>
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Free-text feedback placeholder</Label>
                    <Input
                      value={config.feedbackPlaceholder}
                      onChange={(e) => patchConfig({ feedbackPlaceholder: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="size-3.5" />
                    Live preview — {METRIC_LABELS[activeMetric].name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                  <PhonePreview
                    metric={activeMetric}
                    copy={config.metricCopy[activeMetric]}
                  />
                  <p className="text-[10px] text-center text-muted-foreground mt-3">
                    Switch metric tabs above to preview each one.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ====================================================== */}
        {/*           Tab 2: Metrics & Routing                       */}
        {/* ====================================================== */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enabled metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Toggle which metrics get shown. The server picks one uniformly at random per
                visit.
              </p>
              {ALL_METRICS.map((m) => {
                const enabled = settings.enabledMetrics.includes(m)
                return (
                  <div
                    key={m}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{METRIC_LABELS[m].name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {METRIC_LABELS[m].range}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {METRIC_LABELS[m].note}
                      </p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={() => toggleMetric(m)} />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Per-metric thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Score{' '}
                <strong>at-or-above</strong> the threshold (or{' '}
                <strong>at-or-below</strong> for CES) routes to the happy path. Otherwise it
                routes to the unhappy path.
              </p>
              {ALL_METRICS.map((m) => {
                const range = METRIC_RANGES[m]
                return (
                  <div key={m} className="grid grid-cols-3 items-center gap-3">
                    <Label className="text-sm font-medium">
                      {METRIC_LABELS[m].name}
                      {m === 'ces' && (
                        <span className="ml-1 text-[10px] uppercase text-amber-600">
                          inverted
                        </span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      min={range.min}
                      max={range.max}
                      value={settings.thresholds[m]}
                      onChange={(e) => setThreshold(m, Number(e.target.value))}
                    />
                    <span className="text-xs text-muted-foreground">
                      Range {range.min}–{range.max}, default {DEFAULT_THRESHOLDS[m]}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================================================== */}
        {/*           Tab 3: Redirects & Copy                        */}
        {/* ====================================================== */}
        <TabsContent value="redirects" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Review platform & redirect URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Default platform</Label>
                <Select
                  value={settings.reviewPlatform}
                  onValueChange={(v) => patchSettings({ reviewPlatform: v as ReviewPlatform })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="zomato">Zomato</SelectItem>
                    <SelectItem value="swiggy">Swiggy</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Customers tapping &quot;Yes, leave a review&quot; are redirected to this
                  platform&apos;s URL.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <ExternalLink className="size-3" />
                  Google review URL
                </Label>
                <Input
                  value={config.redirectLinks.google ?? ''}
                  onChange={(e) =>
                    patchConfig({
                      redirectLinks: { ...config.redirectLinks, google: e.target.value },
                    })
                  }
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                />
                <p className="text-xs text-muted-foreground">
                  Auto-filled from this location&apos;s GBP connector when set.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zomato review URL</Label>
                <Input
                  value={config.redirectLinks.zomato ?? ''}
                  onChange={(e) =>
                    patchConfig({
                      redirectLinks: { ...config.redirectLinks, zomato: e.target.value },
                    })
                  }
                  placeholder="https://www.zomato.com/..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Swiggy review URL</Label>
                <Input
                  value={config.redirectLinks.swiggy ?? ''}
                  onChange={(e) =>
                    patchConfig({
                      redirectLinks: { ...config.redirectLinks, swiggy: e.target.value },
                    })
                  }
                  placeholder="https://www.swiggy.com/..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Happy-path prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Prompt question</Label>
                <Input
                  value={config.reviewPromptCopy.question}
                  onChange={(e) =>
                    patchConfig({
                      reviewPromptCopy: {
                        ...config.reviewPromptCopy,
                        question: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Yes button</Label>
                  <Input
                    value={config.reviewPromptCopy.yesLabel}
                    onChange={(e) =>
                      patchConfig({
                        reviewPromptCopy: {
                          ...config.reviewPromptCopy,
                          yesLabel: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">No button</Label>
                  <Input
                    value={config.reviewPromptCopy.noLabel}
                    onChange={(e) =>
                      patchConfig({
                        reviewPromptCopy: {
                          ...config.reviewPromptCopy,
                          noLabel: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Auto-copied review text — this gets copied to clipboard before the customer
                  is redirected
                </Label>
                <Input
                  value={config.reviewTemplate}
                  onChange={(e) => patchConfig({ reviewTemplate: e.target.value })}
                  placeholder="Had a great experience at {businessName}!"
                />
                <p className="text-[10px] text-muted-foreground">
                  Use <code>{'{businessName}'}</code> and <code>{'{metricName}'}</code> as
                  placeholders.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Thank-you messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Happy → tapped Yes</Label>
                <Input
                  value={config.thankYouHappyYes}
                  onChange={(e) => patchConfig({ thankYouHappyYes: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Happy → tapped No</Label>
                <Input
                  value={config.thankYouHappyNo}
                  onChange={(e) => patchConfig({ thankYouHappyNo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unhappy → after feedback submitted</Label>
                <Input
                  value={config.thankYouUnhappy}
                  onChange={(e) => patchConfig({ thankYouUnhappy: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QrCodeDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        journeyId={journey.id}
        journeySlug={journey.slug}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Phone preview — renders the metric input as the customer would see it
// ──────────────────────────────────────────────────────────────────────────

function PhonePreview({ metric, copy }: { metric: Metric; copy: MetricCopy }) {
  const range = METRIC_RANGES[metric]
  const step = metric === 'nev' ? 50 : 1
  const values = useMemo(() => {
    const out: number[] = []
    for (let v = range.min; v <= range.max; v += step) out.push(v)
    return out
  }, [range.min, range.max, step])

  // Display the value list — always render numbers; for NEV bucketed (5 buttons).
  const tooManyForGrid = values.length > 7

  return (
    <div className="flex justify-center">
      {/* Phone frame — iPhone-like, fixed aspect ratio */}
      <div
        className="relative w-full max-w-[320px] rounded-[44px] bg-slate-900 p-3 shadow-2xl"
        style={{ aspectRatio: '9 / 19.5' }}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-3 h-6 w-28 -translate-x-1/2 rounded-full bg-slate-900 z-10" />

        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-gradient-to-b from-slate-50 to-white flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold text-slate-700">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="text-[8px]">●●●●</span>
              <span>5G</span>
              <span className="ml-1">100%</span>
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 space-y-6 overflow-hidden">
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-slate-800 leading-tight">
                {copy.question}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold">
                {METRIC_LABELS[metric].name}
              </p>
            </div>

            <div className="w-full space-y-2.5">
              <div
                className={`grid gap-1.5 w-full ${
                  values.length === 5
                    ? 'grid-cols-5'
                    : values.length === 7
                    ? 'grid-cols-7'
                    : tooManyForGrid
                    ? 'grid-cols-6'
                    : 'grid-cols-5'
                }`}
              >
                {values.map((v) => (
                  <div
                    key={v}
                    className="aspect-square rounded-lg border border-slate-200 bg-white flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    {v}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 px-0.5 leading-tight">
                <span className="max-w-[40%]">{copy.scaleLabels.low}</span>
                <span className="max-w-[40%] text-right">{copy.scaleLabels.high}</span>
              </div>
            </div>

            <div className="w-full rounded-xl bg-slate-800 py-3 text-center text-sm font-semibold text-white shadow-md">
              Continue
            </div>
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-slate-900/40" />

          {/* Powered by */}
          <div className="absolute bottom-6 left-0 right-0 text-center text-[8px] text-slate-300">
            Powered by rectangled.io
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// QR code dialog
// ──────────────────────────────────────────────────────────────────────────

function QrCodeDialog({
  open,
  onOpenChange,
  journeyId,
  journeySlug,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  journeyId: string
  journeySlug: string
}) {
  const [size, setSize] = useState('256')
  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/j/${journeySlug}` : `/j/${journeySlug}`

  const qrQuery = trpc.qr.generateJourneyQr.useQuery(
    { journeyId, size: parseInt(size) },
    { enabled: open && !!journeyId },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Print this and place it where customers will scan it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrQuery.isLoading ? (
            <Skeleton className="size-64 rounded-lg" />
          ) : qrQuery.data?.qrDataUrl ? (
            <img
              src={qrQuery.data.qrDataUrl}
              alt="QR Code"
              className="rounded-lg border"
              style={{ width: parseInt(size), height: parseInt(size) }}
            />
          ) : (
            <div className="flex size-64 items-center justify-center rounded-lg border bg-muted">
              <QrCode className="size-16 text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Size:</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">128px</SelectItem>
                <SelectItem value="256">256px</SelectItem>
                <SelectItem value="512">512px</SelectItem>
                <SelectItem value="1024">1024px</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-center gap-2">
            <Input value={publicUrl} readOnly className="flex-1 text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl)
                toast.success('Link copied')
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button
            onClick={() => {
              if (!qrQuery.data?.qrDataUrl) return
              const link = document.createElement('a')
              link.download = `journey-${journeySlug}-qr.png`
              link.href = qrQuery.data.qrDataUrl
              link.click()
            }}
            disabled={!qrQuery.data?.qrDataUrl}
          >
            <Download className="size-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
