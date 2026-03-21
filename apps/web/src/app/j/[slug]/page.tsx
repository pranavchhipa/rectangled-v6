'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Star, ChevronRight, Loader2, CheckCircle2, MessageSquare } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

interface ScreenData {
  id: string
  order: number
  screenType: string
  title: string | null
  subtitle: string | null
  config: any
}

export default function PublicSurveyPage() {
  const params = useParams()
  const slug = params.slug as string

  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  )

  const [currentScreenIndex, setCurrentScreenIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // Contact fields
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Feedback
  const [feedbackText, setFeedbackText] = useState('')

  // Rating
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)

  // Aspects
  const [selectedAspects, setSelectedAspects] = useState<string[]>([])

  // NPS
  const [npsScore, setNpsScore] = useState<number | null>(null)

  // CSAT / CES
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null)

  const journeyQuery = trpc.journey.getPublic.useQuery(
    { slug },
    { enabled: !!slug }
  )

  const submitMutation = trpc.journey.submitResponse.useMutation({
    onSuccess: () => {
      setIsComplete(true)
      setIsSubmitting(false)
    },
    onError: () => {
      setIsSubmitting(false)
    },
  })

  const journey = journeyQuery.data
  const screens: ScreenData[] = useMemo(() => {
    if (!journey?.screens) return []
    return [...journey.screens].sort((a: any, b: any) => a.order - b.order)
  }, [journey])

  // Build the effective screen order based on branching
  const effectiveScreens = useMemo(() => {
    if (screens.length === 0) return []

    const result: ScreenData[] = []
    const ratingScreen = screens.find((s) => s.screenType === 'rating')
    const positiveThreshold = ratingScreen?.config?.positiveThreshold ?? 4

    // We build the path dynamically based on rating
    for (const screen of screens) {
      // After rating, apply branching
      if (
        rating > 0 &&
        rating >= positiveThreshold &&
        (screen.screenType === 'aspects' || screen.screenType === 'feedback')
      ) {
        // Skip negative-path screens for positive ratings
        continue
      }
      if (
        rating > 0 &&
        rating < positiveThreshold &&
        screen.screenType === 'review_redirect'
      ) {
        // Skip review redirect for negative ratings
        continue
      }
      result.push(screen)
    }
    return result
  }, [screens, rating])

  const currentScreen = effectiveScreens[currentScreenIndex]
  const totalScreens = effectiveScreens.length
  const progressPercent =
    totalScreens > 0 ? ((currentScreenIndex + 1) / totalScreens) * 100 : 0

  const submitResponse = useCallback(
    (screenId?: string, data?: any) => {
      if (!journey) return
      setIsSubmitting(true)
      submitMutation.mutate({
        journeyId: journey.id,
        journeyScreenId: screenId,
        locationId: (journey as any).locationId ?? journey.id,
        sessionId,
        responseData: {
          rating,
          aspects: selectedAspects,
          feedback: feedbackText,
          npsScore,
          satisfactionScore,
          ...responses,
          ...data,
        },
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
      })
    },
    [
      journey,
      sessionId,
      rating,
      selectedAspects,
      feedbackText,
      npsScore,
      satisfactionScore,
      responses,
      customerName,
      customerEmail,
      customerPhone,
      submitMutation,
    ]
  )

  function goNext() {
    if (currentScreenIndex < effectiveScreens.length - 1) {
      setCurrentScreenIndex((i) => i + 1)
    } else {
      // Last screen — submit
      submitResponse(currentScreen?.id)
    }
  }

  function canProceed(): boolean {
    if (!currentScreen) return false
    switch (currentScreen.screenType) {
      case 'rating':
        return rating > 0
      case 'nps':
        return npsScore !== null
      case 'csat':
      case 'ces':
        return satisfactionScore !== null
      case 'feedback':
        return feedbackText.trim().length > 0
      case 'aspects':
        return true // aspects are optional
      case 'contact_collection':
        return true // contact is optional
      case 'review_redirect':
        return true
      case 'thank_you':
        return true
      default:
        return true
    }
  }

  // Loading
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

  // Not found or inactive
  if (!journey || !(journey as any).isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            <MessageSquare className="size-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">
            Survey Not Available
          </h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            This survey is no longer active or the link may be incorrect.
          </p>
        </div>
      </div>
    )
  }

  // Complete
  if (isComplete) {
    const thankYouScreen = screens.find((s) => s.screenType === 'thank_you')
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="size-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {thankYouScreen?.title || 'Thank You!'}
          </h1>
          <p className="text-slate-500">
            {thankYouScreen?.config?.message ||
              'We appreciate your feedback. It helps us improve!'}
          </p>
        </div>
      </div>
    )
  }

  if (!currentScreen) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <Progress value={progressPercent} className="h-1 rounded-none" />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-slate-400 font-medium">
            {currentScreenIndex + 1} / {totalScreens}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {journey.name}
          </span>
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 flex items-center justify-center p-4 pb-8">
        <div className="w-full max-w-md space-y-8">
          {/* Title area */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">
              {currentScreen.title}
            </h1>
            {currentScreen.subtitle && (
              <p className="text-slate-500">{currentScreen.subtitle}</p>
            )}
          </div>

          {/* Screen body */}
          <div className="space-y-6">
            {/* RATING */}
            {currentScreen.screenType === 'rating' && (
              <div className="flex justify-center gap-2">
                {Array.from({
                  length: currentScreen.config?.maxRating ?? 5,
                }).map((_, i) => {
                  const starValue = i + 1
                  const isFilled =
                    starValue <= (hoveredRating || rating)
                  return (
                    <button
                      key={i}
                      type="button"
                      className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                      onMouseEnter={() => setHoveredRating(starValue)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(starValue)}
                    >
                      <Star
                        className={`size-12 transition-colors ${
                          isFilled
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-slate-300'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            )}

            {/* ASPECTS */}
            {currentScreen.screenType === 'aspects' && (
              <div className="grid grid-cols-2 gap-3">
                {(currentScreen.config?.aspects ?? []).map(
                  (aspect: string) => {
                    const isSelected = selectedAspects.includes(aspect)
                    return (
                      <button
                        key={aspect}
                        type="button"
                        className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                        onClick={() =>
                          setSelectedAspects((prev) =>
                            isSelected
                              ? prev.filter((a) => a !== aspect)
                              : [...prev, aspect]
                          )
                        }
                      >
                        {aspect}
                      </button>
                    )
                  }
                )}
              </div>
            )}

            {/* REVIEW REDIRECT */}
            {currentScreen.screenType === 'review_redirect' && (
              <div className="space-y-4 text-center">
                {currentScreen.config?.message && (
                  <p className="text-slate-600">
                    {currentScreen.config.message}
                  </p>
                )}
                <div className="space-y-3">
                  {(currentScreen.config?.links ?? []).map(
                    (link: { platform: string; url: string }, i: number) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.98]"
                      >
                        Leave a Review on {link.platform}
                        <ChevronRight className="size-4" />
                      </a>
                    )
                  )}
                </div>
              </div>
            )}

            {/* FEEDBACK */}
            {currentScreen.screenType === 'feedback' && (
              <textarea
                className="flex min-h-[140px] w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all resize-none"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  currentScreen.config?.placeholder ??
                  'Tell us more about your experience...'
                }
              />
            )}

            {/* CONTACT COLLECTION */}
            {currentScreen.screenType === 'contact_collection' && (
              <div className="space-y-4">
                {(currentScreen.config?.fields ?? ['name', 'email', 'phone']).map(
                  (field: string) => (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-slate-600 capitalize">
                        {field}
                      </Label>
                      <Input
                        type={
                          field === 'email'
                            ? 'email'
                            : field === 'phone'
                            ? 'tel'
                            : 'text'
                        }
                        className="h-12 rounded-xl border-2 border-slate-200 focus-visible:border-primary"
                        placeholder={
                          field === 'name'
                            ? 'Your name'
                            : field === 'email'
                            ? 'your@email.com'
                            : '+91 98765 43210'
                        }
                        value={
                          field === 'name'
                            ? customerName
                            : field === 'email'
                            ? customerEmail
                            : customerPhone
                        }
                        onChange={(e) => {
                          if (field === 'name') setCustomerName(e.target.value)
                          else if (field === 'email')
                            setCustomerEmail(e.target.value)
                          else setCustomerPhone(e.target.value)
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            )}

            {/* THANK YOU (inline — if shown as a step) */}
            {currentScreen.screenType === 'thank_you' && (
              <div className="text-center space-y-3">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                </div>
                <p className="text-slate-500">
                  {currentScreen.config?.message ??
                    'Thank you for your feedback!'}
                </p>
              </div>
            )}

            {/* NPS */}
            {currentScreen.screenType === 'nps' && (
              <div className="space-y-4">
                {currentScreen.config?.question && (
                  <p className="text-center text-slate-600">
                    {currentScreen.config.question}
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`size-11 rounded-xl text-sm font-semibold transition-all ${
                        npsScore === i
                          ? 'bg-primary text-primary-foreground shadow-md scale-110'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      onClick={() => setNpsScore(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 px-1">
                  <span>Not at all likely</span>
                  <span>Extremely likely</span>
                </div>
              </div>
            )}

            {/* CSAT / CES */}
            {(currentScreen.screenType === 'csat' ||
              currentScreen.screenType === 'ces') && (
              <div className="space-y-4">
                {currentScreen.config?.question && (
                  <p className="text-center text-slate-600">
                    {currentScreen.config.question}
                  </p>
                )}
                <div className="flex justify-center gap-3">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`size-14 rounded-2xl text-lg font-bold transition-all ${
                          satisfactionScore === value
                            ? 'bg-primary text-primary-foreground shadow-md scale-110'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        onClick={() => setSatisfactionScore(value)}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-slate-400 px-2">
                  <span>
                    {currentScreen.screenType === 'ces'
                      ? 'Very difficult'
                      : 'Very dissatisfied'}
                  </span>
                  <span>
                    {currentScreen.screenType === 'ces'
                      ? 'Very easy'
                      : 'Very satisfied'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Next / Submit button */}
          {currentScreen.screenType !== 'thank_you' && (
            <Button
              className="w-full h-14 rounded-xl text-base font-semibold shadow-sm"
              size="lg"
              onClick={goNext}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Submitting...
                </>
              ) : currentScreenIndex === effectiveScreens.length - 1 ? (
                'Submit'
              ) : (
                <>
                  Continue
                  <ChevronRight className="size-5" />
                </>
              )}
            </Button>
          )}

          {/* Skip for optional screens */}
          {(currentScreen.screenType === 'aspects' ||
            currentScreen.screenType === 'contact_collection' ||
            currentScreen.screenType === 'feedback') &&
            currentScreenIndex < effectiveScreens.length - 1 && (
              <button
                type="button"
                className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
                onClick={goNext}
              >
                Skip this step
              </button>
            )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-xs text-slate-300">
          Powered by rectangled.io
        </p>
      </div>
    </div>
  )
}
