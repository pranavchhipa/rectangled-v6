'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2,
  CheckCircle2,
  MessageSquare,
  Send,
  Copy,
  ExternalLink,
  Star,
  Eye,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BrandedPublicLayout } from '@/components/public/branded-layout'
import type { PublicBranding } from '@rectangled/shared'

/**
 * Path B — generic public renderer that drives the new survey step
 * engine. Replaces the single-screen legacy renderers that powered
 * /j/[slug] and /f/[slug] (they flattened multi-step graphs to a single
 * screen). This component walks the actual step graph the owner built.
 *
 * Lifecycle:
 *   1. Mount → trpc.survey.getInitialState → first step + branding.
 *   2. Render based on `currentStep.type` (one of 6 customer-facing
 *      kinds — branch_by_score / branch_by_answer are server-side only
 *      and the engine auto-traverses through them).
 *   3. On answer → trpc.survey.advance → next step or `done: true`.
 *   4. On `done: true` → trpc.survey.complete → persist + terminal copy.
 *
 * Preview mode: `?preview=true` propagates through every call. Engine
 * drops the active-status filter and skips writes — the owner can walk
 * a draft survey end-to-end from the editor's Preview button.
 */
export function SurveyEngineRenderer({
  slug,
  preview,
}: {
  slug: string
  preview: boolean
}) {
  type Metric = 'csat' | 'nps' | 'ces' | 'nev' | 'cli'

  // ---- accumulated state ----
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [surveyId, setSurveyId] = useState<string | null>(null)
  const [branding, setBranding] = useState<PublicBranding | null>(null)
  const [currentStep, setCurrentStep] = useState<any | null>(null)
  const [terminalStepId, setTerminalStepId] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [terminalMessage, setTerminalMessage] = useState('Thank you!')
  const [walkerError, setWalkerError] = useState<string | null>(null)

  // Track the metric the customer encountered so the engine can branch.
  const [metricShown, setMetricShown] = useState<Metric | undefined>(undefined)
  const [metricScore, setMetricScore] = useState<number | undefined>(undefined)

  // Accumulate answers and contact for the final complete() call.
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [contact, setContact] = useState<{
    name?: string
    email?: string
    phone?: string
  }>({})
  const [redirectedTo, setRedirectedTo] = useState<
    'google' | 'zomato' | 'swiggy' | undefined
  >(undefined)
  const [acceptedReviewPrompt, setAcceptedReviewPrompt] = useState<
    boolean | undefined
  >(undefined)

  // Refs mirror the accumulated state so `finish()` reads the latest
  // values even when called synchronously after a setState (the
  // setContact-then-advance-then-finish chain in submitContact would
  // otherwise see a stale empty `contact` in the closure and persist
  // "No contact" responses).
  const metricShownRef = useRef<Metric | undefined>(undefined)
  const metricScoreRef = useRef<number | undefined>(undefined)
  const answersRef = useRef<Record<string, unknown>>({})
  const contactRef = useRef<{
    name?: string
    email?: string
    phone?: string
  }>({})
  const redirectedToRef = useRef<
    'google' | 'zomato' | 'swiggy' | undefined
  >(undefined)
  const acceptedReviewPromptRef = useRef<boolean | undefined>(undefined)

  // ---- engine calls ----
  const initial = trpc.survey.getInitialState.useQuery(
    { slug, preview },
    { enabled: !!slug, retry: 0 },
  )
  const advanceMutation = trpc.survey.advance.useMutation()
  const completeMutation = trpc.survey.complete.useMutation()
  const draftMutation = trpc.survey.generateHappyReviewDraft.useMutation()

  // Hydrate from initial state.
  useEffect(() => {
    if (initial.data && !sessionId) {
      setSessionId(initial.data.sessionId)
      setSurveyId(initial.data.surveyId)
      setBranding(initial.data.branding)
      setCurrentStep(initial.data.step)
      if (initial.data.metricShown) {
        setMetricShown(initial.data.metricShown as Metric)
      }
    }
  }, [initial.data, sessionId])

  // ---- step advance helpers ----
  const finish = useCallback(
    async (terminalIdOverride?: string | null) => {
      if (!surveyId || !sessionId) return
      // Read from refs so finish always sees the latest values, even
      // when called synchronously after a setState (e.g. submitContact
      // sets contact then immediately calls advance → finish; the
      // closure capture of `contact` would still be empty).
      const finalContact = contactRef.current
      try {
        const r = await completeMutation.mutateAsync({
          surveyId,
          sessionId,
          finalState: {
            metricShown: metricShownRef.current,
            metricScore: metricScoreRef.current,
            answers: answersRef.current,
            contact:
              Object.keys(finalContact).length > 0 ? finalContact : undefined,
            redirectedTo: redirectedToRef.current,
            acceptedReviewPrompt: acceptedReviewPromptRef.current,
          },
          terminalStepId: terminalIdOverride ?? terminalStepId ?? undefined,
          preview,
        })
        setTerminalMessage(r.terminalMessage)
        setIsDone(true)
      } catch (err: any) {
        setWalkerError(err?.message ?? 'Could not save your response.')
        setIsDone(true)
      }
    },
    [surveyId, sessionId, terminalStepId, preview, completeMutation],
  )

  const advance = useCallback(
    async (args: {
      fromStepId: string
      answer?: unknown
      metricShown?: Metric
      metricScore?: number
    }) => {
      if (!surveyId || !sessionId) return
      try {
        const r = await advanceMutation.mutateAsync({
          surveyId,
          sessionId,
          fromStepId: args.fromStepId,
          answer: args.answer,
          metricShown: args.metricShown,
          metricScore: args.metricScore,
          preview,
        })
        if (r.done) {
          if (r.terminalStep) setTerminalStepId(r.terminalStep.id)
          await finish(r.terminalStep?.id ?? null)
          return
        }
        setCurrentStep(r.nextStep)
        setWalkerError(null) // clear on successful step advance
      } catch (err: any) {
        setWalkerError(err?.message ?? 'Could not advance to the next step.')
      }
    },
    [surveyId, sessionId, preview, advanceMutation, finish],
  )

  // Last action so the customer can retry after a transient failure
  // without restarting the whole flow. Cleared on success.
  const [lastAction, setLastAction] = useState<null | {
    type: 'metric' | 'question' | 'message' | 'contact' | 'redirect-yes' | 'redirect-no'
    payload?: any
  }>(null)

  function retryLastAction() {
    if (!lastAction) return
    setWalkerError(null)
    if (lastAction.type === 'metric') {
      const { score, metric } = lastAction.payload
      submitMetric(score, metric)
    } else if (lastAction.type === 'question') {
      submitQuestion(lastAction.payload)
    } else if (lastAction.type === 'message') {
      submitMessageContinue()
    } else if (lastAction.type === 'contact') {
      submitContact(lastAction.payload)
    } else if (lastAction.type === 'redirect-yes') {
      submitRedirectYes()
    } else if (lastAction.type === 'redirect-no') {
      submitRedirectNo()
    }
  }

  // ---- per-step submit handlers ----
  function submitMetric(score: number, metric: Metric) {
    if (!currentStep) return
    setLastAction({ type: 'metric', payload: { score, metric } })
    // Update refs synchronously so finish() reads the latest.
    metricShownRef.current = metric
    metricScoreRef.current = score
    answersRef.current = {
      ...answersRef.current,
      [currentStep.id]: { metric, score },
    }
    setMetricShown(metric)
    setMetricScore(score)
    setAnswers((prev) => ({ ...prev, [currentStep.id]: { metric, score } }))
    advance({
      fromStepId: currentStep.id,
      metricShown: metric,
      metricScore: score,
    })
  }

  function submitQuestion(answer: unknown) {
    if (!currentStep) return
    setLastAction({ type: 'question', payload: answer })
    answersRef.current = { ...answersRef.current, [currentStep.id]: answer }
    setAnswers((prev) => ({ ...prev, [currentStep.id]: answer }))
    advance({ fromStepId: currentStep.id, answer })
  }

  function submitMessageContinue() {
    if (!currentStep) return
    setLastAction({ type: 'message' })
    advance({ fromStepId: currentStep.id })
  }

  function submitContact(c: { name?: string; email?: string; phone?: string }) {
    if (!currentStep) return
    setLastAction({ type: 'contact', payload: c })
    // Critical — write contact to the ref synchronously. finish() reads
    // from this ref; without the synchronous write, the contact form
    // submission would land "Anonymous / No contact" because the
    // setContact state update hasn't settled before finish runs.
    contactRef.current = { ...contactRef.current, ...c }
    answersRef.current = { ...answersRef.current, [currentStep.id]: c }
    setContact((prev) => ({ ...prev, ...c }))
    setAnswers((prev) => ({ ...prev, [currentStep.id]: c }))
    advance({ fromStepId: currentStep.id, answer: c })
  }

  async function submitRedirectYes() {
    if (!currentStep || !surveyId) return
    setLastAction({ type: 'redirect-yes' })
    const cfg = currentStep.config as {
      platform: 'google' | 'zomato' | 'swiggy'
      url?: string
      reviewTemplate?: string
    }
    acceptedReviewPromptRef.current = true
    redirectedToRef.current = cfg.platform
    setAcceptedReviewPrompt(true)
    setRedirectedTo(cfg.platform)

    // Phase 1 — AI review draft to clipboard before redirect.
    let clipboardText = cfg.reviewTemplate || ''
    try {
      const draft = await draftMutation.mutateAsync({
        journeyId: surveyId,
        metricShown,
        metricScore,
      })
      if (draft?.text) clipboardText = draft.text
    } catch {
      /* fall back to static template */
    }
    if (
      clipboardText &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard
    ) {
      try {
        await navigator.clipboard.writeText(clipboardText)
      } catch {
        /* surfaced as fallback UI below if needed */
      }
    }
    if (cfg.url) {
      window.open(cfg.url, '_blank', 'noopener,noreferrer')
    }
    advance({ fromStepId: currentStep.id, answer: 'yes' })
  }

  function submitRedirectNo() {
    if (!currentStep) return
    setLastAction({ type: 'redirect-no' })
    acceptedReviewPromptRef.current = false
    setAcceptedReviewPrompt(false)
    advance({ fromStepId: currentStep.id, answer: 'no' })
  }

  // ---- render ----
  if (initial.isLoading) return <RendererSkeleton />
  if (initial.isError || !initial.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            <MessageSquare className="size-8 text-slate-400" />
          </div>
          <h2 className="mt-3 text-xl font-semibold">Survey not available</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This link may have been archived or the URL is mistyped.
          </p>
        </Card>
      </div>
    )
  }

  if (!branding || !currentStep) return <RendererSkeleton />

  return (
    <BrandedPublicLayout
      branding={branding}
      topSlot={
        preview ? (
          <div className="border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
            <Eye className="mr-1 inline-block size-3.5" />
            <strong>Preview mode</strong> · responses are NOT saved · close
            this tab to exit
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5 sm:space-y-7">
        {walkerError && (
          <div
            className="rounded-xl border-2 p-3 text-sm"
            style={{
              borderColor: 'rgba(220, 38, 38, 0.3)',
              backgroundColor: 'rgba(220, 38, 38, 0.05)',
              color: '#991b1b',
            }}
          >
            <p className="font-medium">{walkerError}</p>
            {lastAction && (
              <button
                type="button"
                onClick={retryLastAction}
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {isDone ? (
          <TerminalScreen message={terminalMessage} />
        ) : (
          // key={currentStep.id} — force the step component to remount on
          // every step change. Per-step components own local input state
          // (text, multi-select, pending score, hovered star, contact
          // fields). Without remount, React reconciles by position and
          // reuses the old instance with stale state — e.g. the textarea
          // of the previous Open Question would still hold its content
          // when the next Open Question loads.
          <StepRenderer
            key={currentStep.id}
            step={currentStep}
            onMetricSubmit={submitMetric}
            onQuestionSubmit={submitQuestion}
            onMessageContinue={submitMessageContinue}
            onContactSubmit={submitContact}
            onRedirectYes={submitRedirectYes}
            onRedirectNo={submitRedirectNo}
            isSubmitting={
              advanceMutation.isPending ||
              completeMutation.isPending ||
              draftMutation.isPending
            }
          />
        )}
      </div>
    </BrandedPublicLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Skeleton + terminal
// ─────────────────────────────────────────────────────────────────────────

function RendererSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="w-full max-w-md space-y-6">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function TerminalScreen({ message }: { message: string }) {
  return (
    <div className="space-y-3 text-center sm:space-y-4">
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-full sm:size-20"
        style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 15%, white)' }}
      >
        <CheckCircle2
          className="size-8 sm:size-10"
          style={{ color: 'var(--brand)' }}
        />
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
        {message}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Step-type router
// ─────────────────────────────────────────────────────────────────────────

function StepRenderer({
  step,
  onMetricSubmit,
  onQuestionSubmit,
  onMessageContinue,
  onContactSubmit,
  onRedirectYes,
  onRedirectNo,
  isSubmitting,
}: {
  step: any
  onMetricSubmit: (score: number, metric: 'csat' | 'nps' | 'ces' | 'nev' | 'cli') => void
  onQuestionSubmit: (answer: unknown) => void
  onMessageContinue: () => void
  onContactSubmit: (c: { name?: string; email?: string; phone?: string }) => void
  onRedirectYes: () => void
  onRedirectNo: () => void
  isSubmitting: boolean
}) {
  switch (step.type) {
    case 'ask_metric':
      return (
        <MetricStep
          step={step}
          onSubmit={onMetricSubmit}
          isSubmitting={isSubmitting}
        />
      )
    case 'ask_question':
      return (
        <QuestionStep
          step={step}
          onSubmit={onQuestionSubmit}
          isSubmitting={isSubmitting}
        />
      )
    case 'show_message':
      return (
        <MessageStep
          step={step}
          onContinue={onMessageContinue}
          isSubmitting={isSubmitting}
        />
      )
    case 'collect_contact':
      return (
        <ContactStep
          step={step}
          onSubmit={onContactSubmit}
          isSubmitting={isSubmitting}
        />
      )
    case 'redirect':
      return (
        <RedirectStep
          step={step}
          onYes={onRedirectYes}
          onNo={onRedirectNo}
          isSubmitting={isSubmitting}
        />
      )
    default:
      return (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Unsupported step type: <code>{step.type}</code>
        </div>
      )
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ask_metric
// ─────────────────────────────────────────────────────────────────────────

const METRIC_RANGE: Record<
  string,
  { min: number; max: number; step: number }
> = {
  csat: { min: 1, max: 5, step: 1 },
  nps: { min: 0, max: 10, step: 1 },
  ces: { min: 1, max: 7, step: 1 },
  nev: { min: -100, max: 100, step: 50 },
  cli: { min: 1, max: 7, step: 1 },
}

function MetricStep({
  step,
  onSubmit,
  isSubmitting,
}: {
  step: any
  onSubmit: (score: number, metric: 'csat' | 'nps' | 'ces' | 'nev' | 'cli') => void
  isSubmitting: boolean
}) {
  const cfg = step.config as {
    metric: 'csat' | 'nps' | 'ces' | 'nev' | 'cli' | 'random'
    question: string
    scaleLabels?: { low?: string; high?: string }
  }
  // engine resolves 'random' before sending; if we somehow still get it,
  // default to csat so the renderer doesn't crash.
  const metric =
    cfg.metric === 'random' || !METRIC_RANGE[cfg.metric] ? 'csat' : cfg.metric
  const range = METRIC_RANGE[metric]
  const [pending, setPending] = useState<number | null>(null)
  // Hovered-star state is only used by the csat branch but lives at the
  // top level so React Hooks rules are satisfied.
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  const values = useMemo(() => {
    const out: number[] = []
    for (let v = range.min; v <= range.max; v += range.step) out.push(v)
    return out
  }, [range])

  if (metric === 'csat') {
    return (
      <div className="space-y-2.5 sm:space-y-3">
        <p
          className="text-center text-[20px] font-extrabold leading-[1.15] tracking-tight sm:text-[26px]"
          style={{ color: 'var(--navy)' }}
        >
          {cfg.question}
        </p>
        <p
          className="text-center text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
          style={{ color: 'var(--navy)', opacity: 0.55 }}
        >
          CSAT
        </p>
        <div className="flex justify-center gap-2 py-1 sm:gap-4 sm:py-2">
          {[1, 2, 3, 4, 5].map((starNum) => {
            const filled =
              hoveredStar != null
                ? starNum <= hoveredStar
                : pending != null && starNum <= pending
            return (
              <button
                key={starNum}
                type="button"
                onClick={() => {
                  setPending(starNum)
                  onSubmit(starNum, metric)
                }}
                onMouseEnter={() => setHoveredStar(starNum)}
                onMouseLeave={() => setHoveredStar(null)}
                disabled={isSubmitting}
              >
                <Star
                  className="size-9 sm:size-12"
                  style={
                    filled
                      ? { fill: 'var(--brand)', color: 'var(--brand)' }
                      : { color: 'var(--gold)' }
                  }
                  strokeWidth={1.5}
                />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <div className="text-center">
        <h1
          className="text-[22px] font-extrabold leading-[1.15] tracking-tight sm:text-[28px]"
          style={{ color: 'var(--navy)' }}
        >
          {cfg.question}
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
                : 'grid-cols-11'
          }`}
        >
          {values.map((v) => {
            const selected = pending === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setPending(v)}
                disabled={isSubmitting}
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
        {cfg.scaleLabels && (
          <div
            className="flex justify-between px-1 text-[10px] font-semibold sm:text-[11px]"
            style={{ color: 'var(--navy)', opacity: 0.55 }}
          >
            <span>{cfg.scaleLabels.low ?? ''}</span>
            <span>{cfg.scaleLabels.high ?? ''}</span>
          </div>
        )}
      </div>
      <Button
        className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14 sm:text-[15px]"
        size="lg"
        onClick={() => pending !== null && onSubmit(pending, metric)}
        disabled={pending === null || isSubmitting}
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// ask_question
// ─────────────────────────────────────────────────────────────────────────

function QuestionStep({
  step,
  onSubmit,
  isSubmitting,
}: {
  step: any
  onSubmit: (answer: unknown) => void
  isSubmitting: boolean
}) {
  const cfg = step.config as {
    fieldType:
      | 'text'
      | 'textarea'
      | 'select'
      | 'multi_select'
      | 'rating'
      | 'yes_no'
    question: string
    options?: string[]
    required?: boolean
  }
  const [text, setText] = useState('')
  const [multi, setMulti] = useState<string[]>([])
  const [single, setSingle] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)

  const valid =
    !cfg.required ||
    (cfg.fieldType === 'multi_select'
      ? multi.length > 0
      : cfg.fieldType === 'rating'
        ? rating !== null
        : cfg.fieldType === 'select' || cfg.fieldType === 'yes_no'
          ? single !== null
          : text.trim().length > 0)

  function handleSubmit() {
    if (cfg.fieldType === 'multi_select') onSubmit(multi)
    else if (cfg.fieldType === 'rating') onSubmit(rating)
    else if (cfg.fieldType === 'select' || cfg.fieldType === 'yes_no')
      onSubmit(single)
    else onSubmit(text.trim())
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <h1
        className="text-center text-[22px] font-extrabold leading-[1.15] tracking-tight sm:text-[26px]"
        style={{ color: 'var(--navy)' }}
      >
        {cfg.question}
      </h1>

      {cfg.fieldType === 'text' && (
        <input
          type="text"
          className="h-12 w-full rounded-xl border-2 bg-white px-4 text-[14px]"
          style={{ borderColor: 'rgba(17, 34, 79, 0.15)', color: 'var(--navy)' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = 'rgba(17, 34, 79, 0.15)')
          }
        />
      )}

      {cfg.fieldType === 'textarea' && (
        <textarea
          className="min-h-[120px] w-full resize-none rounded-xl border-2 bg-white px-4 py-3 text-[14px]"
          style={{ borderColor: 'rgba(17, 34, 79, 0.15)', color: 'var(--navy)' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = 'rgba(17, 34, 79, 0.15)')
          }
        />
      )}

      {cfg.fieldType === 'select' && cfg.options && (
        <div className="space-y-2">
          {cfg.options.map((opt) => {
            const selected = single === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setSingle(opt)}
                className="block w-full rounded-xl border-2 px-4 py-3 text-left text-[14px] font-semibold transition-all"
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
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {cfg.fieldType === 'multi_select' && cfg.options && (
        <div className="flex flex-wrap gap-2">
          {cfg.options.map((opt) => {
            const selected = multi.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  setMulti((prev) =>
                    prev.includes(opt)
                      ? prev.filter((p) => p !== opt)
                      : [...prev, opt],
                  )
                }
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
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {cfg.fieldType === 'rating' && (
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
            >
              <Star
                className="size-10"
                style={
                  rating !== null && n <= rating
                    ? { fill: 'var(--brand)', color: 'var(--brand)' }
                    : { color: 'var(--gold)' }
                }
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      )}

      {cfg.fieldType === 'yes_no' && (
        <div className="grid grid-cols-2 gap-3">
          {['yes', 'no'].map((opt) => {
            const selected = single === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setSingle(opt)}
                className="h-12 rounded-xl border-2 text-[14px] font-bold transition-all"
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
                {opt === 'yes' ? 'Yes' : 'No'}
              </button>
            )
          })}
        </div>
      )}

      <Button
        className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14 sm:text-[15px]"
        size="lg"
        onClick={handleSubmit}
        disabled={!valid || isSubmitting}
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Continue'}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// show_message
// ─────────────────────────────────────────────────────────────────────────

function MessageStep({
  step,
  onContinue,
  isSubmitting,
}: {
  step: any
  onContinue: () => void
  isSubmitting: boolean
}) {
  const cfg = step.config as { title?: string; body: string }
  return (
    <div className="space-y-5 text-center sm:space-y-6">
      {cfg.title && (
        <h1
          className="text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]"
          style={{ color: 'var(--navy)' }}
        >
          {cfg.title}
        </h1>
      )}
      <p
        className="text-[14px] sm:text-[15px]"
        style={{ color: 'var(--navy)', opacity: 0.8 }}
      >
        {cfg.body}
      </p>
      <Button
        className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14"
        onClick={onContinue}
        disabled={isSubmitting}
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Continue'}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// collect_contact
// ─────────────────────────────────────────────────────────────────────────

function ContactStep({
  step,
  onSubmit,
  isSubmitting,
}: {
  step: any
  onSubmit: (c: { name?: string; email?: string; phone?: string }) => void
  isSubmitting: boolean
}) {
  const cfg = step.config as {
    fields: Array<{ key: 'name' | 'email' | 'phone'; required: boolean }>
    privacyNote?: string
  }
  const [values, setValues] = useState<{
    name: string
    email: string
    phone: string
  }>({ name: '', email: '', phone: '' })

  const valid = cfg.fields.every(
    (f) => !f.required || values[f.key].trim().length > 0,
  )

  function handleSubmit() {
    onSubmit({
      name: values.name.trim() || undefined,
      email: values.email.trim() || undefined,
      phone: values.phone.trim() || undefined,
    })
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1
        className="text-center text-[20px] font-extrabold leading-tight tracking-tight sm:text-[24px]"
        style={{ color: 'var(--navy)' }}
      >
        Stay in touch
      </h1>
      {cfg.privacyNote && (
        <p
          className="text-center text-[12px]"
          style={{ color: 'var(--navy)', opacity: 0.65 }}
        >
          {cfg.privacyNote}
        </p>
      )}
      <div className="space-y-3">
        {cfg.fields.map((f) => (
          <input
            key={f.key}
            type={f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
            placeholder={
              f.key === 'name'
                ? 'Your name'
                : f.key === 'email'
                  ? 'your@email.com'
                  : '+91 98765 43210'
            }
            value={values[f.key]}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
            }
            className="h-12 w-full rounded-xl border-2 bg-white px-4 text-[14px]"
            style={{ borderColor: 'rgba(17, 34, 79, 0.15)', color: 'var(--navy)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(17, 34, 79, 0.15)')
            }
          />
        ))}
      </div>
      <Button
        className="h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:h-14"
        onClick={handleSubmit}
        disabled={!valid || isSubmitting}
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <>
            <Send className="size-4" />
            Continue
          </>
        )}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// redirect (Yes/No prompt + AI clipboard + external open)
// ─────────────────────────────────────────────────────────────────────────

function RedirectStep({
  step,
  onYes,
  onNo,
  isSubmitting,
}: {
  step: any
  onYes: () => void
  onNo: () => void
  isSubmitting: boolean
}) {
  const cfg = step.config as {
    platform: 'google' | 'zomato' | 'swiggy'
    url?: string
    reviewTemplate?: string
    yesLabel?: string
    noLabel?: string
  }
  const [showFallback, setShowFallback] = useState(false)
  const hasClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full sm:size-16"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 15%, white)' }}
        >
          <CheckCircle2
            className="size-7 sm:size-8"
            style={{ color: 'var(--brand)' }}
          />
        </div>
        <h1
          className="mt-3 text-[22px] font-extrabold leading-[1.15] tracking-tight sm:mt-4 sm:text-[26px]"
          style={{ color: 'var(--navy)' }}
        >
          Would you mind leaving a review?
        </h1>
      </div>

      {showFallback && cfg.url && (
        <div
          className="space-y-3 rounded-xl border-2 p-4"
          style={{
            borderColor: 'rgba(17, 34, 79, 0.12)',
            backgroundColor: 'rgba(17, 34, 79, 0.03)',
          }}
        >
          <p
            className="text-xs font-medium"
            style={{ color: 'var(--navy)', opacity: 0.65 }}
          >
            Copy this and paste it on the review page:
          </p>
          <textarea
            readOnly
            className="min-h-[80px] w-full resize-none rounded-lg border-2 bg-white px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: 'rgba(17, 34, 79, 0.15)', color: 'var(--navy)' }}
            value={cfg.reviewTemplate ?? ''}
          />
          <a
            href={cfg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--brand)' }}
          >
            Open review page <ExternalLink className="size-3" />
          </a>
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
                {cfg.yesLabel ?? 'Sure'}
              </>
            )}
          </Button>
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
          {cfg.noLabel ?? 'Maybe later'}
        </Button>
      </div>
    </div>
  )
}
