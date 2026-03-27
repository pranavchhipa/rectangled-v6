'use client'

import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Star, Loader2, CheckCircle2, MessageSquare, X, Send } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function PublicSurveyPage() {
  const params = useParams()
  const slug = params.slug as string

  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  )

  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const journeyQuery = trpc.journey.getPublic.useQuery(
    { slug },
    { enabled: !!slug }
  )

  const submitMutation = trpc.journey.submitResponse.useMutation({
    onSuccess: () => {
      setIsSubmitting(false)
    },
    onError: () => {
      setIsSubmitting(false)
    },
  })

  const journey = journeyQuery.data
  const screens = useMemo(() => {
    if (!journey?.screens) return []
    return [...journey.screens].sort((a: any, b: any) => a.order - b.order)
  }, [journey])

  // Find key screens
  const ratingScreen = screens.find((s: any) => s.screenType === 'rating')
  const feedbackScreen = screens.find((s: any) => s.screenType === 'feedback')
  const reviewRedirectScreen = screens.find((s: any) => s.screenType === 'review_redirect')
  const thankYouScreen = screens.find((s: any) => s.screenType === 'thank_you')

  const positiveThreshold = ratingScreen?.config?.positiveThreshold ?? 4
  const isDirectReview = positiveThreshold === 0
  const feedbackTags: string[] = feedbackScreen?.config?.tags ?? ['Food Quality', 'Service', 'Cleanliness', 'Wait Time', 'Staff Behavior', 'Ambience']

  // Get Google review URL
  const googleLink = (reviewRedirectScreen?.config?.links ?? []).find(
    (l: any) => l.platform === 'Google'
  )
  const googleReviewUrl = googleLink?.url || ''

  const submitFeedback = useCallback(() => {
    if (!journey || !ratingScreen) return
    setIsSubmitting(true)
    submitMutation.mutate({
      journeyId: journey.id,
      journeyScreenId: ratingScreen.id,
      locationId: (journey as any).locationId || undefined,
      sessionId,
      responseData: {
        rating,
        feedback: feedbackText,
        tags: selectedTags,
      },
    }, {
      onSuccess: () => {
        setIsSubmitting(false)
        setShowFeedbackDialog(false)
        setIsComplete(true)
      },
    })
  }, [journey, ratingScreen, sessionId, rating, feedbackText, selectedTags, submitMutation])

  const handleSubmit = useCallback(() => {
    if (!journey || !ratingScreen || rating === 0) return

    // Direct Review: any rating → redirect to Google
    if (isDirectReview) {
      setIsSubmitting(true)
      submitMutation.mutate({
        journeyId: journey.id,
        journeyScreenId: ratingScreen.id,
        locationId: (journey as any).locationId || undefined,
        sessionId,
        responseData: { rating },
      }, {
        onSuccess: () => {
          setIsSubmitting(false)
          if (googleReviewUrl) {
            window.location.href = googleReviewUrl
          } else {
            setIsComplete(true)
          }
        },
      })
      return
    }

    // Review Option: negative rating → show feedback dialog
    if (rating < positiveThreshold) {
      setShowFeedbackDialog(true)
      return
    }

    // Review Option: positive rating → submit & redirect to Google
    setIsSubmitting(true)
    submitMutation.mutate({
      journeyId: journey.id,
      journeyScreenId: ratingScreen.id,
      locationId: (journey as any).locationId || undefined,
      sessionId,
      responseData: { rating },
    }, {
      onSuccess: () => {
        setIsSubmitting(false)
        if (googleReviewUrl) {
          window.location.href = googleReviewUrl
        } else {
          setIsComplete(true)
        }
      },
    })
  }, [journey, ratingScreen, rating, isDirectReview, positiveThreshold, googleReviewUrl, sessionId, submitMutation])

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
          <h1 className="text-xl font-semibold text-slate-800">Survey Not Available</h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            This survey is no longer active or the link may be incorrect.
          </p>
        </div>
      </div>
    )
  }

  // No screens configured
  if (!ratingScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            <MessageSquare className="size-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Survey Not Ready</h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            This survey has not been configured yet. Please check back later.
          </p>
        </div>
      </div>
    )
  }

  // Thank you / complete
  if (isComplete) {
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
            {thankYouScreen?.config?.message || 'We appreciate your feedback. It helps us improve!'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Main content — single screen with stars */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">
              {ratingScreen.title || 'How was your experience?'}
            </h1>
            {ratingScreen.subtitle && (
              <p className="text-slate-500">{ratingScreen.subtitle}</p>
            )}
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: ratingScreen.config?.maxRating ?? 5 }).map((_, i) => {
              const starValue = i + 1
              const isFilled = starValue <= (hoveredRating || rating)
              return (
                <button
                  key={i}
                  type="button"
                  className="transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                  onMouseEnter={() => setHoveredRating(starValue)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(starValue)}
                >
                  <Star
                    className={`size-14 transition-colors ${
                      isFilled
                        ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                        : 'fill-transparent text-slate-300'
                    }`}
                  />
                </button>
              )
            })}
          </div>

          {/* Rating label */}
          {rating > 0 && (
            <p className="text-center text-sm text-slate-500">
              {rating <= 2 ? 'We\'re sorry to hear that' : rating === 3 ? 'We can do better' : rating === 4 ? 'Glad you liked it!' : 'Awesome! Thank you!'}
            </p>
          )}

          {/* Submit button */}
          <Button
            className="w-full h-14 rounded-xl text-base font-semibold shadow-sm"
            size="lg"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </div>

      {/* Negative Feedback Dialog/Overlay */}
      {showFeedbackDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowFeedbackDialog(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Close button */}
            <button
              type="button"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              onClick={() => setShowFeedbackDialog(false)}
            >
              <X className="size-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-800">
                {feedbackScreen?.title || 'What went wrong?'}
              </h2>
              <p className="text-sm text-slate-500">
                {feedbackScreen?.subtitle || 'Help us improve your experience'}
              </p>
            </div>

            {/* Tappable tags */}
            <div className="flex flex-wrap gap-2">
              {feedbackTags.map((tag) => {
                const isSelected = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all border ${
                      isSelected
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    onClick={() =>
                      setSelectedTags((prev) =>
                        isSelected
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag]
                      )
                    }
                  >
                    {tag}
                  </button>
                )
              })}
            </div>

            {/* Optional text input */}
            <textarea
              className="w-full min-h-[100px] rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors resize-none"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={feedbackScreen?.config?.placeholder || 'Tell us more (optional)...'}
            />

            {/* Submit feedback */}
            <Button
              className="w-full h-12 rounded-xl font-semibold"
              onClick={submitFeedback}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-xs text-slate-300">Powered by rectangled.io</p>
      </div>
    </div>
  )
}
