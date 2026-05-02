'use client'

/**
 * Hotfix PRD §2.6 — adaptive survey settings form.
 *
 * Replaces the React Flow canvas for surveys with template='adaptive'.
 * Owner edits the v2 Adaptive Journey config as a flat form:
 *
 *   - Enabled metrics (CSAT / NPS / CES / NEV / CLI checkboxes)
 *   - Per-metric thresholds
 *   - Review platform + URL (with banner when URL is empty)
 *   - Aspect tags (unhappy path)
 *   - Thank-you copy (happy yes / happy no / unhappy)
 *
 * Saves via survey.update — same endpoint the rest of the editor uses.
 * Settings are merged shallow-server-side so partial updates work.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Metric = 'csat' | 'nps' | 'ces' | 'nev' | 'cli'
type Platform = 'google' | 'zomato' | 'swiggy'

const METRICS: Array<{
  key: Metric
  label: string
  scale: string
  rule: string
}> = [
  { key: 'csat', label: 'CSAT', scale: '1-5', rule: 'Higher = happier' },
  { key: 'nps', label: 'NPS', scale: '0-10', rule: 'Higher = happier' },
  { key: 'ces', label: 'CES', scale: '1-7', rule: 'Lower = happier (inverted)' },
  { key: 'nev', label: 'NEV', scale: '-100 to +100', rule: 'Higher = happier' },
  { key: 'cli', label: 'CLI', scale: '1-7', rule: 'Higher = happier' },
]

const DEFAULT_THRESHOLDS: Record<Metric, number> = {
  csat: 4,
  nps: 9,
  ces: 3,
  nev: 0,
  cli: 5,
}

interface AdaptiveSettingsFormProps {
  surveyId: string
  template: 'adaptive'
  initialSettings: Record<string, unknown>
  onSaved?: () => void
}

export function AdaptiveSettingsForm({
  surveyId,
  initialSettings,
  onSaved,
}: AdaptiveSettingsFormProps) {
  const utils = trpc.useUtils()

  // Flatten settings into form fields. Settings shape is loose
  // (z.record(unknown)) so we coerce defensively.
  const [enabledMetrics, setEnabledMetrics] = useState<Metric[]>(
    (Array.isArray(initialSettings.enabledMetrics)
      ? (initialSettings.enabledMetrics as Metric[])
      : ['csat', 'nps', 'ces', 'nev', 'cli']),
  )
  const [thresholds, setThresholds] = useState<Record<Metric, number>>({
    ...DEFAULT_THRESHOLDS,
    ...(typeof initialSettings.thresholds === 'object' && initialSettings.thresholds
      ? (initialSettings.thresholds as Record<Metric, number>)
      : {}),
  })
  const [platform, setPlatform] = useState<Platform>(
    (initialSettings.reviewPlatform as Platform) ?? 'google',
  )
  const initialRedirectLinks =
    (initialSettings.redirectLinks as Partial<Record<Platform, string>>) ?? {}
  const [redirectUrl, setRedirectUrl] = useState<string>(
    initialRedirectLinks[
      (initialSettings.reviewPlatform as Platform) ?? 'google'
    ] ?? '',
  )
  const [aspectTagsCsv, setAspectTagsCsv] = useState<string>(
    Array.isArray(initialSettings.aspectTags)
      ? (initialSettings.aspectTags as string[]).join(', ')
      : '',
  )
  const [reviewTemplate, setReviewTemplate] = useState<string>(
    (initialSettings.reviewTemplate as string) ??
      'Had a great experience at {businessName}!',
  )
  const [thankYouHappyYes, setThankYouHappyYes] = useState<string>(
    (initialSettings.thankYouHappyYes as string) ??
      'Thank you! Opening the review page now.',
  )
  const [thankYouHappyNo, setThankYouHappyNo] = useState<string>(
    (initialSettings.thankYouHappyNo as string) ?? 'Thanks for your time!',
  )
  const [thankYouUnhappy, setThankYouUnhappy] = useState<string>(
    (initialSettings.thankYouUnhappy as string) ??
      "Thank you for the feedback. We'll work on it.",
  )
  const [dirty, setDirty] = useState(false)

  // When the user switches platform, swap the URL field to that
  // platform's previously-saved value (or empty).
  useEffect(() => {
    setRedirectUrl(initialRedirectLinks[platform] ?? '')
    // intentionally NOT depending on initialRedirectLinks (it's a fresh
    // object on every render); we only swap on platform change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  const updateMutation = trpc.survey.update.useMutation({
    onSuccess: () => {
      toast.success('Adaptive settings saved')
      utils.survey.getById.invalidate({ id: surveyId })
      utils.survey.list.invalidate()
      setDirty(false)
      if (onSaved) onSaved()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save')
    },
  })

  function toggleMetric(m: Metric) {
    setEnabledMetrics((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m],
    )
    setDirty(true)
  }

  function patchThreshold(m: Metric, raw: string) {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    setThresholds((cur) => ({ ...cur, [m]: n }))
    setDirty(true)
  }

  function handleSave() {
    if (enabledMetrics.length === 0) {
      toast.error('At least one metric must be enabled.')
      return
    }
    const aspectTags = aspectTagsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // Merge URL into redirectLinks for the active platform.
    const newRedirectLinks = {
      ...initialRedirectLinks,
      [platform]: redirectUrl,
    }

    const settings: Record<string, unknown> = {
      ...initialSettings,
      enabledMetrics,
      thresholds,
      reviewPlatform: platform,
      redirectLinks: newRedirectLinks,
      aspectTags,
      reviewTemplate,
      thankYouHappyYes,
      thankYouHappyNo,
      thankYouUnhappy,
    }

    updateMutation.mutate({ id: surveyId, settings })
  }

  const urlIsEmpty = !redirectUrl.trim()

  return (
    <div className="space-y-4">
      {/* Owner banner — surfaces the empty-URL gap right where they'll see it */}
      {urlIsEmpty && (
        <Alert
          variant="default"
          className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30"
        >
          <AlertTriangle className="size-4 text-amber-700" />
          <AlertTitle>Positive-path redirect URL is missing</AlertTitle>
          <AlertDescription className="text-xs">
            Customers who give a positive rating won't be redirected to{' '}
            <strong>{platform}</strong> until you set the URL below.
          </AlertDescription>
        </Alert>
      )}

      {/* Enabled metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metrics to ask</CardTitle>
          <CardDescription className="text-xs">
            The server picks one of the enabled metrics randomly per visit.
            At least one must be enabled (otherwise the public URL 404s).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {METRICS.map((m) => (
            <label
              key={m.key}
              className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
            >
              <Checkbox
                checked={enabledMetrics.includes(m.key)}
                onCheckedChange={() => toggleMetric(m.key)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase">
                    {m.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    scale {m.scale}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {m.rule}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Threshold:
                </Label>
                <Input
                  className="w-20 text-right tabular-nums"
                  type="number"
                  value={thresholds[m.key]}
                  onChange={(e) => patchThreshold(m.key, e.target.value)}
                  disabled={!enabledMetrics.includes(m.key)}
                />
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Review platform + URL — positive path */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Positive path</CardTitle>
          <CardDescription className="text-xs">
            When a customer's score crosses the threshold, they're prompted
            to leave a review on this platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(v) => {
                setPlatform(v as Platform)
                setDirty(true)
              }}
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
          </div>
          <div className="space-y-1.5">
            <Label>Review URL</Label>
            <Input
              value={redirectUrl}
              onChange={(e) => {
                setRedirectUrl(e.target.value)
                setDirty(true)
              }}
              placeholder={
                platform === 'google'
                  ? 'https://g.page/r/...'
                  : platform === 'zomato'
                    ? 'https://www.zomato.com/...'
                    : 'https://www.swiggy.com/...'
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Review template (auto-copied to clipboard)</Label>
            <Textarea
              rows={2}
              value={reviewTemplate}
              onChange={(e) => {
                setReviewTemplate(e.target.value)
                setDirty(true)
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Use{' '}
              <code className="rounded bg-muted px-1">{'{businessName}'}</code>{' '}
              for the location/workspace name.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Negative path */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Negative path</CardTitle>
          <CardDescription className="text-xs">
            When a score is below threshold, the customer sees aspect-tag
            pills and an optional contact form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Aspect tags (comma-separated)</Label>
            <Input
              value={aspectTagsCsv}
              onChange={(e) => {
                setAspectTagsCsv(e.target.value)
                setDirty(true)
              }}
              placeholder="Service, Quality, Cleanliness, Wait time"
            />
          </div>
        </CardContent>
      </Card>

      {/* Thank-you copy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thank-you messages</CardTitle>
          <CardDescription className="text-xs">
            Different copy for each terminal state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Positive → tapped Yes (redirected to review)</Label>
            <Input
              value={thankYouHappyYes}
              onChange={(e) => {
                setThankYouHappyYes(e.target.value)
                setDirty(true)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Positive → tapped No (declined to review)</Label>
            <Input
              value={thankYouHappyNo}
              onChange={(e) => {
                setThankYouHappyNo(e.target.value)
                setDirty(true)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Negative (after aspect feedback)</Label>
            <Input
              value={thankYouUnhappy}
              onChange={(e) => {
                setThankYouUnhappy(e.target.value)
                setDirty(true)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          size="lg"
        >
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save adaptive settings
        </Button>
      </div>
    </div>
  )
}
