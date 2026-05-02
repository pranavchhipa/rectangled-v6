'use client'

/**
 * Hotfix PRD §3 (PR 1) — Wizard Custom Journey Builder modal.
 *
 * 4-question wizard. Maps deterministically to a step graph via
 * `buildCustomStepsFromWizard` (server-side, in
 * `survey.createFromWizard`). Q1's 'random' option short-circuits to
 * `template='adaptive'` — the wizard skips Q2-Q4 and submits with just
 * the name.
 *
 * Vocabulary discipline:
 *   - This wizard's copy uses NATURAL LANGUAGE ("When the customer is
 *     positive..."), NOT STEP_TYPE_LABELS. STEP_TYPE_LABELS belongs to
 *     the decision-tree editor + insert modal (PR 2).
 *   - Always Positive/Negative — never happy/unhappy.
 *
 * On success: closes modal, invalidates surveys list, redirects to the
 * surveys list. PR 2 will replace the redirect with the new decision-
 * tree editor for `template='custom'`.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WizardAnswers } from '@rectangled/shared'

type WizardMetric = WizardAnswers['metric']
type WizardPositiveAction = WizardAnswers['positiveAction']
type WizardStep = 1 | 2 | 3 | 4

interface CreateCustomJourneyWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

// Threshold preset shortcuts per metric. CES is inverted, so its
// presets read as "<= N" semantically — the engine uses op='lte' which
// the helper picks up from INVERTED_METRICS.
const THRESHOLD_PRESETS: Record<
  Exclude<WizardMetric, 'random'>,
  Array<{ label: string; value: number }>
> = {
  csat: [
    { label: '4 or 5 stars', value: 4 },
    { label: '5 stars only', value: 5 },
  ],
  nps: [
    { label: '9 or 10', value: 9 },
    { label: '10 only', value: 10 },
  ],
  ces: [
    { label: '3 or less', value: 3 },
    { label: '2 or less', value: 2 },
  ],
}

const DEFAULT_THRESHOLD: Record<Exclude<WizardMetric, 'random'>, number> = {
  csat: 4,
  nps: 9,
  ces: 3,
}

// ─── Inline RadioCard helper (no shadcn radio-group in this codebase) ───

function RadioCard({
  selected,
  onClick,
  title,
  description,
  disabled,
}: {
  selected: boolean
  onClick: () => void
  title: string
  description?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-3 rounded-md border p-3 text-left transition',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        selected
          ? 'border-primary bg-primary/5'
          : !disabled && 'border-input hover:bg-muted/30',
      )}
    >
      <div
        className={cn(
          'mt-0.5 size-4 shrink-0 rounded-full border-2',
          selected
            ? 'border-primary bg-primary ring-2 ring-primary/20'
            : 'border-input',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </button>
  )
}

// ─── Main component ─────────────────────────────────────────────────────

export function CreateCustomJourneyWizard({
  open,
  onOpenChange,
  workspaceId,
}: CreateCustomJourneyWizardProps) {
  const router = useRouter()
  const utils = trpc.useUtils()

  const [step, setStep] = useState<WizardStep>(1)
  const [name, setName] = useState('')
  const [metric, setMetric] = useState<WizardMetric>('csat')
  const [positiveAction, setPositiveAction] = useState<WizardPositiveAction>('redirect_google')
  const [askAspects, setAskAspects] = useState(true)
  const [askFeedback, setAskFeedback] = useState(false)
  const [collectContact, setCollectContact] = useState(true)
  const [issueCoupon, setIssueCoupon] = useState(false)
  const [couponTemplateId, setCouponTemplateId] = useState<string | undefined>(undefined)
  const [threshold, setThreshold] = useState<number>(4)
  const [thresholdMode, setThresholdMode] = useState<'preset_a' | 'preset_b' | 'custom'>('preset_a')

  // Coupon templates drive the 0/1/2+ logic for the issueCoupon checkbox.
  const couponTemplatesQuery = trpc.coupon.listTemplates.useQuery(
    { workspaceId },
    { enabled: !!workspaceId && open },
  )
  const couponTemplatesData = (couponTemplatesQuery.data ?? []) as Array<{
    id: string
    name: string
    isActive: boolean
  }>
  const activeCouponTemplates = couponTemplatesData.filter((t) => t.isActive)
  const couponState: 'none' | 'single' | 'multiple' =
    activeCouponTemplates.length === 0
      ? 'none'
      : activeCouponTemplates.length === 1
        ? 'single'
        : 'multiple'

  // Auto-resolve couponTemplateId in the 'single' case so the server
  // doesn't have to round-trip lookup for the obvious choice.
  useEffect(() => {
    if (issueCoupon && couponState === 'single' && !couponTemplateId) {
      setCouponTemplateId(activeCouponTemplates[0]?.id)
    }
    if (!issueCoupon) {
      setCouponTemplateId(undefined)
    }
  }, [issueCoupon, couponState, activeCouponTemplates, couponTemplateId])

  const createMutation = trpc.survey.createFromWizard.useMutation({
    onSuccess: (created) => {
      toast.success(
        metric === 'random'
          ? 'Adaptive journey created'
          : 'Custom journey created — opening editor',
      )
      utils.survey.list.invalidate()
      onOpenChange(false)
      // Custom journeys → decision-tree editor (PR 2).
      // Adaptive journeys → AdaptiveSettingsForm (§2).
      // Both live at /dashboard/journeys/{id} (Hotfix §5 rename); the
      // editor branches by template internally.
      if (created?.id) {
        router.push(`/dashboard/journeys/${created.id}`)
      } else {
        router.push('/dashboard/journeys')
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create journey')
    },
  })

  function reset() {
    setStep(1)
    setName('')
    setMetric('csat')
    setPositiveAction('redirect_google')
    setAskAspects(true)
    setAskFeedback(false)
    setCollectContact(true)
    setIssueCoupon(false)
    setCouponTemplateId(undefined)
    setThreshold(4)
    setThresholdMode('preset_a')
  }

  function handleClose(o: boolean) {
    if (!o) reset()
    onOpenChange(o)
  }

  function pickMetric(m: WizardMetric) {
    setMetric(m)
    if (m !== 'random') {
      setThreshold(DEFAULT_THRESHOLD[m])
      setThresholdMode('preset_a')
    }
  }

  function pickThresholdMode(mode: 'preset_a' | 'preset_b' | 'custom') {
    setThresholdMode(mode)
    if (mode !== 'custom' && metric !== 'random') {
      const presets = THRESHOLD_PRESETS[metric]
      const pick = mode === 'preset_a' ? presets[0] : presets[1]
      if (pick) setThreshold(pick.value)
    }
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Give the journey a name first.')
      setStep(1)
      return
    }
    createMutation.mutate({
      workspaceId,
      name: name.trim(),
      answers: {
        metric,
        positiveAction,
        negativeOptions: { askAspects, askFeedback, collectContact, issueCoupon },
        threshold,
        couponTemplateId: issueCoupon ? couponTemplateId : undefined,
      },
    })
  }

  const isRandom = metric === 'random'
  const totalSteps = isRandom ? 1 : 4

  // Validation per step — disables Continue until satisfied.
  const canContinueFromStep1 = name.trim().length > 0
  const canContinueFromStep3 =
    !issueCoupon ||
    couponState === 'single' ||
    (couponState === 'multiple' && !!couponTemplateId)
  const canSubmitFinal =
    canContinueFromStep1 &&
    (!issueCoupon ||
      couponState === 'single' ||
      (couponState === 'multiple' && !!couponTemplateId))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Create Custom Journey
          </DialogTitle>
          <DialogDescription>
            Step {isRandom ? 1 : step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cj-name">Journey name</Label>
                <Input
                  id="cj-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dine-in feedback"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>What do you want to ask first?</Label>
                <div className="space-y-2">
                  <RadioCard
                    selected={metric === 'csat'}
                    onClick={() => pickMetric('csat')}
                    title="Their rating (1–5 stars / CSAT)"
                    description="Customer satisfaction on a 5-point scale."
                  />
                  <RadioCard
                    selected={metric === 'nps'}
                    onClick={() => pickMetric('nps')}
                    title="How likely they'd recommend us (NPS)"
                    description="0–10 likelihood-to-recommend."
                  />
                  <RadioCard
                    selected={metric === 'ces'}
                    onClick={() => pickMetric('ces')}
                    title="How easy was their experience (CES)"
                    description="1–7 effort score (lower is better)."
                  />
                  <RadioCard
                    selected={metric === 'random'}
                    onClick={() => pickMetric('random')}
                    title="Let the system pick randomly (becomes Adaptive)"
                    description="Each customer sees a randomly-picked metric. Creates an Adaptive journey instead of Custom."
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && !isRandom && (
            <div className="space-y-2">
              <Label>When the customer is positive, what should happen?</Label>
              <div className="space-y-2">
                <RadioCard
                  selected={positiveAction === 'redirect_google'}
                  onClick={() => setPositiveAction('redirect_google')}
                  title="Redirect to Google review"
                />
                <RadioCard
                  selected={positiveAction === 'redirect_zomato'}
                  onClick={() => setPositiveAction('redirect_zomato')}
                  title="Redirect to Zomato"
                />
                <RadioCard
                  selected={positiveAction === 'just_thank'}
                  onClick={() => setPositiveAction('just_thank')}
                  title="Just thank them"
                  description="No external review redirect — single thank-you screen."
                />
              </div>
            </div>
          )}

          {step === 3 && !isRandom && (
            <div className="space-y-2">
              <Label>When the customer is negative, what should happen?</Label>
              <p className="text-xs text-muted-foreground">
                Pick any combination. Steps run in this order: aspects → feedback → contact.
              </p>

              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30">
                <Checkbox
                  checked={askAspects}
                  onCheckedChange={(v) => setAskAspects(!!v)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Ask what went wrong (multi-select pills)</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    We'll start with common feedback categories. You can customize them after.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30">
                <Checkbox
                  checked={askFeedback}
                  onCheckedChange={(v) => setAskFeedback(!!v)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Ask them to type detailed feedback</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Free-text textarea — optional for the customer.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30">
                <Checkbox
                  checked={collectContact}
                  onCheckedChange={(v) => setCollectContact(!!v)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Collect their contact for follow-up</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Name, phone, email — all optional.
                  </div>
                </div>
              </label>

              <label
                className={cn(
                  'flex items-start gap-3 rounded-md border p-3',
                  couponState === 'none'
                    ? 'opacity-60 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-muted/30',
                )}
                title={
                  couponState === 'none'
                    ? 'Create a coupon template first (Settings → Coupons)'
                    : undefined
                }
              >
                <Checkbox
                  checked={issueCoupon}
                  onCheckedChange={(v) => setIssueCoupon(!!v)}
                  disabled={couponState === 'none'}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Issue a recovery coupon</div>
                  {couponState === 'none' ? (
                    <div className="mt-0.5 text-xs text-amber-700">
                      Create a coupon template first (Settings → Coupons)
                    </div>
                  ) : couponState === 'single' ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Will use:{' '}
                      <span className="font-medium">
                        {activeCouponTemplates[0]?.name}
                      </span>
                    </div>
                  ) : null}
                </div>
              </label>

              {issueCoupon && couponState === 'multiple' && (
                <div className="ml-7 space-y-1.5">
                  <Label>Which coupon to issue?</Label>
                  <Select
                    value={couponTemplateId}
                    onValueChange={(v) => setCouponTemplateId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a coupon template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCouponTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {step === 4 && !isRandom && (
            <div className="space-y-2">
              <Label>What's the threshold for positive?</Label>
              <p className="text-xs text-muted-foreground">
                {metric === 'ces'
                  ? 'CES is inverted — lower scores mean a better experience.'
                  : `Higher ${metric.toUpperCase()} scores are positive.`}
              </p>
              <div className="space-y-2">
                <RadioCard
                  selected={thresholdMode === 'preset_a'}
                  onClick={() => pickThresholdMode('preset_a')}
                  title={THRESHOLD_PRESETS[metric][0]?.label ?? ''}
                />
                <RadioCard
                  selected={thresholdMode === 'preset_b'}
                  onClick={() => pickThresholdMode('preset_b')}
                  title={THRESHOLD_PRESETS[metric][1]?.label ?? ''}
                />
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-md border p-3',
                    thresholdMode === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-input',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => pickThresholdMode('custom')}
                    className="flex shrink-0 items-center gap-2 text-sm font-medium"
                  >
                    <div
                      className={cn(
                        'size-4 rounded-full border-2',
                        thresholdMode === 'custom'
                          ? 'border-primary bg-primary ring-2 ring-primary/20'
                          : 'border-input',
                      )}
                    />
                    Custom:
                  </button>
                  <Input
                    type="number"
                    className="w-24"
                    value={thresholdMode === 'custom' ? threshold : ''}
                    placeholder="e.g. 7"
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n)) setThreshold(n)
                      setThresholdMode('custom')
                    }}
                    onFocus={() => setThresholdMode('custom')}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
              disabled={createMutation.isPending}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span /> /* spacer to keep right-aligned button on the right */
          )}

          {/* Forward / Submit button. Logic:
              - Random metric: step 1 directly submits as adaptive
              - Custom: step 1-3 advance, step 4 submits */}
          {isRandom ? (
            <Button
              onClick={handleSubmit}
              disabled={!canContinueFromStep1 || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Generate Adaptive Journey
            </Button>
          ) : step < 4 ? (
            <Button
              onClick={() => setStep((s) => Math.min(4, s + 1) as WizardStep)}
              disabled={
                (step === 1 && !canContinueFromStep1) ||
                (step === 3 && !canContinueFromStep3)
              }
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmitFinal || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Generate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
