'use client'

import { useState, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, MessageSquare, Send, Copy, ExternalLink, Eye } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BrandedPublicLayout } from '@/components/public/branded-layout'
import type { PublicBranding } from '@rectangled/shared'

type Metric = 'csat' | 'nps' | 'ces' | 'nev' | 'cli'
type FlowState =
  | 'asking_metric'
  | 'happy_review_prompt'
  | 'unhappy_feedback'
  | 'thank_you'
  | 'redirecting'

const METRIC_RANGE: Record<Metric, { min: number; max: number; step: number }> = {
  csat: { min: 1, max: 5, step: 1 },
  nps: { min: 0, max: 10, step: 1 },
  ces: { min: 1, max: 7, step: 1 },
  nev: { min: -100, max: 100, step: 50 },
  cli: { min: 1, max: 7, step: 1 },
}

export default function PublicJourneyPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  // Hotfix PRD §3.6 — owner-side preview mode. When `?preview=true` is
  // in the URL, every submit call passes `preview: true` so the engine
  // skips inserting survey_starts / survey_responses / customers /
  // reviews. Used by the decision-tree editor's "📱 Preview" button.
  const isPreview = searchParams?.get('preview') === 'true'

  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
  )

  const [flowState, setFlowState] = useState<FlowState>('asking_metric')
  const [score, setScore] = useState<number | null>(null)
  const [responseId, setResponseId] = useState<string | null>(null)
  const [thankYouText, setThankYouText] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Unhappy form state
  const [selectedAspects, setSelectedAspects] = useState<string[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Phase 5 — reads now come from the survey engine (legacy shape).
  // The renderer's UI is unchanged; only the query target moved.
  // journey.getPublic was removed when the legacy tables dropped.
  const journeyQuery = trpc.survey.getPublicLegacyJourney.useQuery(
    { slug },
    { enabled: !!slug },
  )
  // Phase 3 Stage E — writes go through the new survey engine via the
  // legacy compat shim. Same input/return shape, so the renderer logic
  // below didn't have to change. journey.submitResponse is frozen as
  // of Phase 4.
  const submitMutation = trpc.survey.submitLegacyJourney.useMutation()

  const journey = journeyQuery.data as
    | undefined
    | {
        id: string
        slug: string
        name: string
        locationId: string | null
        settings: { reviewPlatform: 'google' | 'zomato' | 'swiggy' | string }
        // Hotfix §4 — server-resolved branding (location → workspace
        // → defaults). Renderer holds across the whole flow.
        branding: PublicBranding
        screen: {
          id: string
          metricShown: Metric
          question: string
          scaleLabels: { low: string; high: string }
          aspectTags: string[]
          feedbackPlaceholder: string
          reviewPromptCopy: { question: string; yesLabel: string; noLabel: string }
          redirectLinks: { google?: string; zomato?: string; swiggy?: string }
          reviewTemplate: string
          thankYouHappyYes: string
          thankYouHappyNo: string
          thankYouUnhappy: string
        }
      }

  const screen = journey?.screen
  const platform = (journey?.settings.reviewPlatform ?? 'google') as 'google' | 'zomato' | 'swiggy'
  const redirectUrl = screen?.redirectLinks?.[platform]

  const metricRange = useMemo(
    () => (screen ? METRIC_RANGE[screen.metricShown] : null),
    [screen],
  )

  const submitMetric = useCallback(
    async (chosenScore: number) => {
      if (!journey || !screen) return
      setIsSubmitting(true)
      try {
        const result = await submitMutation.mutateAsync({
          journeyId: journey.id,
          journeyScreenId: screen.id,
          locationId: journey.locationId ?? undefined,
          sessionId,
          responseData: {
            metricShown: screen.metricShown,
            metricScore: chosenScore,
          },
          preview: isPreview,
        })
        setResponseId(result.responseId)
        setScore(chosenScore)
        if (result.isPositive === true) {
          setFlowState('happy_review_prompt')
        } else {
          setFlowState('unhappy_feedback')
        }
      } catch (err) {
        console.error('Submit failed', err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [journey, screen, sessionId, submitMutation],
  )

  const handleHappyYes = useCallback(async () => {
    if (!journey || !screen || !responseId) return
    setIsSubmitting(true)

    // Copy review template to clipboard (best-effort).
    if (screen.reviewTemplate && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(screen.reviewTemplate)
      } catch {
        /* fallback below */
      }
    }

    try {
      await submitMutation.mutateAsync({
        journeyId: journey.id,
        sessionId,
        updateResponseId: responseId,
        responseData: {
          acceptedReviewPrompt: true,
          redirectedTo: platform,
        },
        preview: isPreview,
      })
      setThankYouText(screen.thankYouHappyYes)
      setFlowState('thank_you')
      if (redirectUrl) {
        // Open in a new tab so the thank-you stays visible.
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      console.error('Submit failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [journey, screen, responseId, sessionId, submitMutation, platform, redirectUrl])

  const handleHappyNo = useCallback(async () => {
    if (!journey || !screen || !responseId) return
    setIsSubmitting(true)
    try {
      await submitMutation.mutateAsync({
        journeyId: journey.id,
        sessionId,
        updateResponseId: responseId,
        responseData: { acceptedReviewPrompt: false },
        preview: isPreview,
      })
      setThankYouText(screen.thankYouHappyNo)
      setFlowState('thank_you')
    } catch (err) {
      console.error('Submit failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [journey, screen, responseId, sessionId, submitMutation])

  const submitUnhappy = useCallback(async () => {
    if (!journey || !screen || !responseId) return
    setIsSubmitting(true)
    try {
      await submitMutation.mutateAsync({
        journeyId: journey.id,
        sessionId,
        updateResponseId: responseId,
        responseData: {
          aspectTags: selectedAspects,
          feedback: feedbackText || undefined,
        },
        customerName: name || undefined,
        customerEmail: email || undefined,
        customerPhone: phone || undefined,
        preview: isPreview,
      })
      setThankYouText(screen.thankYouUnhappy)
      setFlowState('thank_you')
    } catch (err) {
      console.error('Submit failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    journey,
    screen,
    responseId,
    sessionId,
    submitMutation,
    selectedAspects,
    feedbackText,
    name,
    email,
    phone,
  ])

  // ===== Render =====

  if (journeyQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!journey || !screen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            <MessageSquare className="size-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Journey Not Available</h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            This journey is no longer active or the link may be incorrect.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BrandedPublicLayout
      branding={journey.branding}
      topSlot={
        isPreview ? (
          <div className="border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
            <Eye className="mr-1 inline-block size-3.5" />
            <strong>Preview mode</strong> · responses are NOT saved · close
            this tab to exit
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {flowState === 'asking_metric' && (
          <MetricInput
            metric={screen.metricShown}
            question={screen.question}
            scaleLabels={screen.scaleLabels}
            range={metricRange!}
            isSubmitting={isSubmitting}
            onSubmit={submitMetric}
          />
        )}

        {flowState === 'happy_review_prompt' && (
          <HappyPrompt
            copy={screen.reviewPromptCopy}
            isSubmitting={isSubmitting}
            onYes={handleHappyYes}
            onNo={handleHappyNo}
            reviewTemplate={screen.reviewTemplate}
            redirectUrl={redirectUrl}
          />
        )}

        {flowState === 'unhappy_feedback' && (
          <UnhappyFeedback
            aspectTags={screen.aspectTags}
            selectedAspects={selectedAspects}
            onToggleAspect={(tag) =>
              setSelectedAspects((prev) =>
                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
              )
            }
            feedbackText={feedbackText}
            onFeedbackChange={setFeedbackText}
            feedbackPlaceholder={screen.feedbackPlaceholder}
            name={name}
            phone={phone}
            email={email}
            onNameChange={setName}
            onPhoneChange={setPhone}
            onEmailChange={setEmail}
            isSubmitting={isSubmitting}
            onSubmit={submitUnhappy}
          />
        )}

        {flowState === 'thank_you' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Thank You!</h1>
            <p className="text-slate-500">{thankYouText}</p>
          </div>
        )}
      </div>
    </BrandedPublicLayout>
  )
}

// ============================================================
// Metric input — renders one of CSAT/NPS/CES/NEV/CLI
// ============================================================
function MetricInput({
  metric,
  question,
  scaleLabels,
  range,
  isSubmitting,
  onSubmit,
}: {
  metric: Metric
  question: string
  scaleLabels: { low: string; high: string }
  range: { min: number; max: number; step: number }
  isSubmitting: boolean
  onSubmit: (score: number) => void
}) {
  const [pendingScore, setPendingScore] = useState<number | null>(null)

  // Build the available values based on the metric's range/step.
  const values = useMemo(() => {
    const out: number[] = []
    for (let v = range.min; v <= range.max; v += range.step) out.push(v)
    return out
  }, [range])

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-800">{question}</h1>
        <p className="text-xs uppercase tracking-wider text-slate-400">{metric.toUpperCase()}</p>
      </div>

      <div className="space-y-3">
        <div
          className={`grid gap-2 ${
            values.length <= 5
              ? 'grid-cols-5'
              : values.length <= 7
              ? 'grid-cols-7'
              : 'grid-cols-6'
          }`}
        >
          {values.map((v) => {
            const selected = pendingScore === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setPendingScore(v)}
                className={`min-h-[44px] rounded-xl border-2 py-3 text-base font-semibold transition-all ${
                  selected
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {v}
              </button>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-500 px-1">
          <span>{scaleLabels.low}</span>
          <span>{scaleLabels.high}</span>
        </div>
      </div>

      <Button
        className="w-full h-14 rounded-xl text-base font-semibold shadow-sm"
        size="lg"
        onClick={() => pendingScore !== null && onSubmit(pendingScore)}
        disabled={pendingScore === null || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Submitting...
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  )
}

// ============================================================
// Happy path — Yes/No to leave a review
// ============================================================
function HappyPrompt({
  copy,
  isSubmitting,
  onYes,
  onNo,
  reviewTemplate,
  redirectUrl,
}: {
  copy: { question: string; yesLabel: string; noLabel: string }
  isSubmitting: boolean
  onYes: () => void
  onNo: () => void
  reviewTemplate: string
  redirectUrl?: string
}) {
  const [showFallback, setShowFallback] = useState(false)
  const hasClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{copy.question}</h1>
      </div>

      {showFallback && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs text-slate-500">Copy this and paste it on the review page:</p>
          <textarea
            readOnly
            className="w-full min-h-[80px] rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm"
            value={reviewTemplate}
          />
          {redirectUrl && (
            <a
              href={redirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600"
            >
              Open review page <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Button
          className="w-full h-14 rounded-xl text-base font-semibold"
          size="lg"
          onClick={() => {
            if (!hasClipboard) setShowFallback(true)
            onYes()
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Copy className="size-4" />
              {copy.yesLabel}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 rounded-xl"
          onClick={onNo}
          disabled={isSubmitting}
        >
          {copy.noLabel}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Unhappy path — aspect tags + feedback + optional contact
// ============================================================
function UnhappyFeedback({
  aspectTags,
  selectedAspects,
  onToggleAspect,
  feedbackText,
  onFeedbackChange,
  feedbackPlaceholder,
  name,
  phone,
  email,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  isSubmitting,
  onSubmit,
}: {
  aspectTags: string[]
  selectedAspects: string[]
  onToggleAspect: (tag: string) => void
  feedbackText: string
  onFeedbackChange: (s: string) => void
  feedbackPlaceholder: string
  name: string
  phone: string
  email: string
  onNameChange: (s: string) => void
  onPhoneChange: (s: string) => void
  onEmailChange: (s: string) => void
  isSubmitting: boolean
  onSubmit: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-800">What went wrong?</h2>
        <p className="text-sm text-slate-500">Help us improve your next experience.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {aspectTags.map((tag) => {
          const selected = selectedAspects.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleAspect(tag)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-medium border transition-all ${
                selected
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>

      <textarea
        className="w-full min-h-[100px] rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors resize-none"
        value={feedbackText}
        onChange={(e) => onFeedbackChange(e.target.value)}
        placeholder={feedbackPlaceholder}
      />

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-slate-400">Optional — so we can reach out</p>
        <input
          type="text"
          className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm focus:outline-none focus:border-slate-400"
          placeholder="Your name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <input
          type="tel"
          className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm focus:outline-none focus:border-slate-400"
          placeholder="Phone"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
        />
        <input
          type="email"
          className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm focus:outline-none focus:border-slate-400"
          placeholder="Email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>

      <Button
        className="w-full h-14 rounded-xl text-base font-semibold"
        size="lg"
        onClick={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <>
            <Send className="size-4" />
            Submit Feedback
          </>
        )}
      </Button>
    </div>
  )
}
