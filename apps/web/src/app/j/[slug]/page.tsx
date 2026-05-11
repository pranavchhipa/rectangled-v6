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
  // Hotfix-2 — pass `preview` so draft journeys render in preview mode
  // (the active-status filter on the engine is bypassed when preview
  // is true). Without this, the editor's Preview button on a fresh
  // draft journey 404s and the renderer hangs on its skeleton.
  const journeyQuery = trpc.survey.getPublicLegacyJourney.useQuery(
    { slug, preview: isPreview },
    { enabled: !!slug },
  )
  // Phase 3 Stage E — writes go through the new survey engine via the
  // legacy compat shim. Same input/return shape, so the renderer logic
  // below didn't have to change. journey.submitResponse is frozen as
  // of Phase 4.
  const submitMutation = trpc.survey.submitLegacyJourney.useMutation()
  // Journey A Step 3a.1 — AI review draft mutation. Fired on YES click
  // before the submit + redirect; the returned text goes to the user's
  // clipboard. Falls back to the static template inside handleHappyYes
  // if this call fails, so the customer is never stranded.
  const draftMutation = trpc.survey.generateHappyReviewDraft.useMutation()

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

    // Journey A Step 3a.1 — fetch an AI-composed positive review tailored
    // to the business + the score the customer just gave. Falls back to
    // the static `screen.reviewTemplate` if the AI call fails or returns
    // empty, so the clipboard always has something paste-able.
    let clipboardText: string = screen.reviewTemplate
    try {
      const draft = await draftMutation.mutateAsync({
        journeyId: journey.id,
        metricShown: screen.metricShown,
        metricScore: score ?? undefined,
      })
      if (draft?.text) clipboardText = draft.text
    } catch (err) {
      console.warn('AI review draft failed, using template fallback', err)
    }

    if (clipboardText && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(clipboardText)
      } catch {
        /* clipboard write may fail on some browsers — UX still proceeds */
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
  }, [
    journey,
    screen,
    responseId,
    sessionId,
    score,
    submitMutation,
    draftMutation,
    platform,
    redirectUrl,
    isPreview,
  ])

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
          // Hotfix-8 — brand-color celebration ring, navy heading.
          // Hotfix-9 — mobile-first sizing.
          <div className="space-y-3 text-center sm:space-y-4">
            <div
              className="mx-auto flex size-16 items-center justify-center rounded-full sm:size-20"
              style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 15%, white)' }}
            >
              <CheckCircle2 className="size-8 sm:size-10" style={{ color: 'var(--brand)' }} />
            </div>
            <h1
              className="text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px]"
              style={{ color: 'var(--navy)' }}
            >
              Thank You!
            </h1>
            <p
              className="text-[14px] font-medium sm:text-[15px]"
              style={{ color: 'var(--navy)', opacity: 0.7 }}
            >
              {thankYouText}
            </p>
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

  // Hotfix-8 — Afraa-style refactor. Navy heading, brand-color selected
  // state, brand-color Continue button. Reads --navy / --brand / --gold
  // CSS vars exposed by BrandedPublicLayout.
  // Hotfix-9 — mobile-first sizing so the whole NPS flow fits in one
  // iPhone SE viewport (667px) without scrolling.
  return (
    <div className="space-y-5 sm:space-y-7">
      <div className="text-center">
        <h1
          className="text-[22px] font-extrabold leading-[1.15] tracking-tight sm:text-[28px]"
          style={{ color: 'var(--navy)' }}
        >
          {question}
        </h1>
        <p
          className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
          style={{ color: 'var(--navy)', opacity: 0.55 }}
        >
          {metric.toUpperCase()}
        </p>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        <div
          className={`grid gap-1.5 sm:gap-2 ${
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
                className={`min-h-[40px] rounded-xl border-2 py-2 text-[14px] font-bold transition-all sm:min-h-[48px] sm:py-3 sm:text-[15px] ${
                  selected ? 'scale-105 text-white shadow-md' : 'bg-white'
                }`}
                style={
                  selected
                    ? {
                        backgroundColor: 'var(--brand)',
                        borderColor: 'var(--brand)',
                      }
                    : {
                        borderColor: 'rgba(17, 34, 79, 0.15)',
                        color: 'var(--navy)',
                      }
                }
              >
                {v}
              </button>
            )
          })}
        </div>
        <div
          className="flex justify-between px-1 text-[10px] font-semibold sm:text-[11px]"
          style={{ color: 'var(--navy)', opacity: 0.55 }}
        >
          <span>{scaleLabels.low}</span>
          <span>{scaleLabels.high}</span>
        </div>
      </div>

      <Button
        className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14 sm:text-[15px]"
        size="lg"
        onClick={() => pendingScore !== null && onSubmit(pendingScore)}
        disabled={pendingScore === null || isSubmitting}
        style={{ backgroundColor: 'var(--brand)' }}
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

  // Hotfix-8 — Afraa-style refactor. Brand-color celebration ring on
  // the checkmark, navy heading, brand-primary YES button + outline NO.
  // Hotfix-9 — mobile-first sizing so this flow fits one viewport.
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full sm:size-16"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 15%, white)' }}
        >
          <CheckCircle2 className="size-7 sm:size-8" style={{ color: 'var(--brand)' }} />
        </div>
        <h1
          className="mt-3 text-[22px] font-extrabold leading-[1.15] tracking-tight sm:mt-4 sm:text-[26px]"
          style={{ color: 'var(--navy)' }}
        >
          {copy.question}
        </h1>
      </div>

      {showFallback && (
        <div
          className="space-y-3 rounded-xl border-2 p-4"
          style={{
            borderColor: 'rgba(17, 34, 79, 0.12)',
            backgroundColor: 'rgba(17, 34, 79, 0.03)',
          }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--navy)', opacity: 0.65 }}>
            Copy this and paste it on the review page:
          </p>
          <textarea
            readOnly
            className="w-full min-h-[80px] resize-none rounded-lg border-2 bg-white px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: 'rgba(17, 34, 79, 0.15)', color: 'var(--navy)' }}
            value={reviewTemplate}
          />
          {redirectUrl && (
            <a
              href={redirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--brand)' }}
            >
              Open review page <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}

      <div className="space-y-2.5 sm:space-y-3">
        <div>
          <Button
            className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14 sm:text-[15px]"
            size="lg"
            onClick={() => {
              if (!hasClipboard) setShowFallback(true)
              onYes()
            }}
            disabled={isSubmitting}
            style={{ backgroundColor: 'var(--brand)' }}
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
          {/* Journey A Step 3a.1 helper — explains the clipboard hand-off
              to the customer so the "Copy" icon on the button isn't a
              surprise once they paste on Google / Zomato. */}
          <p
            className="mt-2 text-center text-[11px] font-medium leading-snug sm:text-[12px]"
            style={{ color: 'var(--navy)', opacity: 0.6 }}
          >
            An AI-generated review will be copied for you to paste
          </p>
        </div>
        <Button
          variant="ghost"
          className="h-11 w-full rounded-xl border-2 text-[13px] font-semibold transition-colors hover:bg-slate-50 sm:h-12 sm:text-[14px]"
          onClick={onNo}
          disabled={isSubmitting}
          style={{
            borderColor: 'rgba(17, 34, 79, 0.18)',
            color: 'var(--navy)',
          }}
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
  // Hotfix-8 — Afraa-style refactor. Navy heading, brand-color selected
  // chips, navy/brand input borders, brand-color Submit.
  // Hotfix-9 — mobile-first sizing.
  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h2
          className="text-[20px] font-extrabold leading-tight tracking-tight sm:text-[24px]"
          style={{ color: 'var(--navy)' }}
        >
          What went wrong?
        </h2>
        <p
          className="mt-1 text-[13px] font-medium sm:text-[14px]"
          style={{ color: 'var(--navy)', opacity: 0.65 }}
        >
          Help us improve your next experience.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {aspectTags.map((tag) => {
          const selected = selectedAspects.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleAspect(tag)}
              className="min-h-[40px] rounded-full border-2 px-4 text-[13px] font-semibold transition-all"
              style={
                selected
                  ? {
                      backgroundColor: 'var(--brand)',
                      borderColor: 'var(--brand)',
                      color: '#fff',
                    }
                  : {
                      backgroundColor: '#fff',
                      borderColor: 'rgba(17, 34, 79, 0.18)',
                      color: 'var(--navy)',
                    }
              }
            >
              {tag}
            </button>
          )
        })}
      </div>

      <textarea
        className="min-h-[100px] w-full resize-none rounded-xl border-2 bg-white px-4 py-3 text-[14px] transition-colors focus:outline-none"
        style={{
          borderColor: 'rgba(17, 34, 79, 0.15)',
          color: 'var(--navy)',
        }}
        value={feedbackText}
        onChange={(e) => onFeedbackChange(e.target.value)}
        placeholder={feedbackPlaceholder}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = 'rgba(17, 34, 79, 0.15)')
        }
      />

      <div className="space-y-3">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: 'var(--navy)', opacity: 0.5 }}
        >
          Optional — so we can reach out
        </p>
        {[
          {
            type: 'text',
            placeholder: 'Your name',
            value: name,
            onChange: onNameChange,
          },
          {
            type: 'tel',
            placeholder: 'Phone',
            value: phone,
            onChange: onPhoneChange,
          },
          {
            type: 'email',
            placeholder: 'Email',
            value: email,
            onChange: onEmailChange,
          },
        ].map((f, i) => (
          <input
            key={i}
            type={f.type}
            className="h-12 w-full rounded-xl border-2 bg-white px-4 text-[14px] transition-colors focus:outline-none"
            style={{
              borderColor: 'rgba(17, 34, 79, 0.15)',
              color: 'var(--navy)',
            }}
            placeholder={f.placeholder}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(17, 34, 79, 0.15)')
            }
          />
        ))}
      </div>

      <Button
        className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14 sm:text-[15px]"
        size="lg"
        onClick={onSubmit}
        disabled={isSubmitting}
        style={{ backgroundColor: 'var(--brand)' }}
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
