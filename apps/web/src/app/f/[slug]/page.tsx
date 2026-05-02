'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { BrandedPublicLayout } from '@/components/public/branded-layout'
import type { PublicBranding } from '@rectangled/shared'

function FormSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </Card>
    </div>
  )
}

function NpsInput({
  value,
  onChange,
  brandColor,
}: {
  value: number | null
  onChange: (v: number) => void
  brandColor: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-base font-medium sm:text-lg">
        How likely are you to recommend us to a friend or colleague?
      </p>
      <div className="grid grid-cols-11 gap-1 sm:gap-1.5">
        {Array.from({ length: 11 }).map((_, i) => {
          const isSelected = value === i
          const bgColor =
            i <= 6
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400'
              : i <= 8
                ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400'
                : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400'

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={`flex aspect-square items-center justify-center rounded-lg border text-sm font-semibold transition-all sm:text-base ${
                isSelected
                  ? 'ring-2 ring-offset-2 scale-110'
                  : bgColor + ' hover:scale-105'
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: brandColor,
                      borderColor: brandColor,
                      color: '#fff',
                      ringColor: brandColor,
                    }
                  : undefined
              }
            >
              {i}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  )
}

function CsatInput({
  value,
  onChange,
  brandColor,
}: {
  value: number | null
  onChange: (v: number) => void
  brandColor: string
}) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-base font-medium sm:text-lg">
        How satisfied are you with our service?
      </p>
      <div className="flex justify-center gap-2 py-2 sm:gap-3">
        {Array.from({ length: 5 }).map((_, i) => {
          const starNum = i + 1
          const isFilled =
            hoveredStar != null ? starNum <= hoveredStar : value != null && starNum <= value

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(starNum)}
              onMouseEnter={() => setHoveredStar(starNum)}
              onMouseLeave={() => setHoveredStar(null)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className="size-10 sm:size-12"
                style={
                  isFilled
                    ? { fill: brandColor, color: brandColor }
                    : undefined
                }
                strokeWidth={1.5}
              />
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Very Dissatisfied</span>
        <span>Very Satisfied</span>
      </div>
    </div>
  )
}

function CesInput({
  value,
  onChange,
  brandColor,
}: {
  value: number | null
  onChange: (v: number) => void
  brandColor: string
}) {
  const labels = [
    'Very Difficult',
    'Difficult',
    'Somewhat Difficult',
    'Neutral',
    'Somewhat Easy',
    'Easy',
    'Very Easy',
  ]

  return (
    <div className="space-y-3">
      <p className="text-base font-medium sm:text-lg">
        How easy was it to get what you needed today?
      </p>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => {
          const num = i + 1
          const isSelected = value === num

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(num)}
              className={`flex flex-col items-center justify-center rounded-lg border p-2 text-sm font-semibold transition-all sm:p-3 ${
                isSelected
                  ? 'ring-2 ring-offset-2 scale-105 text-white'
                  : 'hover:bg-muted hover:scale-105'
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: brandColor,
                      borderColor: brandColor,
                    }
                  : undefined
              }
            >
              {num}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Very Difficult</span>
        <span>Very Easy</span>
      </div>
    </div>
  )
}

export default function PublicFormPage() {
  const params = useParams()
  const slug = params.slug as string

  const [score, setScore] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Phase 5 — reads now come from the survey engine (legacy shape).
  // truform.getPublic was removed when the legacy tables dropped.
  const formQuery = trpc.survey.getPublicLegacyTruform.useQuery(
    { slug },
    { enabled: !!slug }
  )

  // Phase 3 Stage E — writes go through the new survey engine via the
  // legacy compat shim. Same input/return shape; truform.submitResponse
  // is frozen as of Phase 4.
  const submitMutation = trpc.survey.submitLegacyTruform.useMutation({
    onSuccess: () => {
      setSubmitted(true)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit. Please try again.')
    },
  })

  if (formQuery.isLoading) return <FormSkeleton />

  if (formQuery.isError || !formQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h2 className="text-xl font-semibold">Form Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This form may have been removed or the link is incorrect.
          </p>
        </Card>
      </div>
    )
  }

  const form = formQuery.data as typeof formQuery.data & {
    branding: PublicBranding
  }
  // Hotfix §4 — location-level branding takes precedence over the
  // legacy per-survey form.config.brandColor. The latter is preserved
  // server-side for back-compat but ignored at render.
  const branding = form.branding
  const brandColor = branding.brandColor
  const thankYouMessage =
    form.config?.thankYouMessage ?? 'Thank you for your feedback!'

  if (submitted) {
    return (
      <BrandedPublicLayout branding={branding}>
        <Card className="p-8 text-center">
          <div
            className="mx-auto flex size-16 items-center justify-center rounded-full"
            style={{ backgroundColor: brandColor + '20' }}
          >
            <CheckCircle2 className="size-8" style={{ color: brandColor }} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold">Thank You!</h2>
          <p className="mt-2 text-muted-foreground">{thankYouMessage}</p>
        </Card>
      </BrandedPublicLayout>
    )
  }

  const handleSubmit = () => {
    if (score == null) {
      toast.error('Please select a score before submitting.')
      return
    }
    submitMutation.mutate({
      truformId: form.id,
      score,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
    })
  }

  return (
    <BrandedPublicLayout branding={branding}>
      <Card className="p-6 sm:p-8">
        {/* Form name still surfaces here — the branded header above
            shows the BUSINESS name (location → workspace), this shows
            the SURVEY name (e.g. "NPS Q4 2025"). Different concepts. */}
        <h1 className="mb-2 text-xl font-bold sm:text-2xl">{form.name}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          We value your feedback. It only takes a moment.
        </p>

        {/* Score input */}
        {form.type === 'nps' && (
          <NpsInput value={score} onChange={setScore} brandColor={brandColor} />
        )}
        {form.type === 'csat' && (
          <CsatInput value={score} onChange={setScore} brandColor={brandColor} />
        )}
        {form.type === 'ces' && (
          <CesInput value={score} onChange={setScore} brandColor={brandColor} />
        )}
        {form.type === 'custom' && (
          <div className="space-y-3">
            <p className="text-base font-medium">Rate your experience (1-10)</p>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: 10 }).map((_, i) => {
                const num = i + 1
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setScore(num)}
                    className={`flex size-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all ${
                      score === num
                        ? 'text-white ring-2 ring-offset-2'
                        : 'hover:bg-muted'
                    }`}
                    style={
                      score === num
                        ? { backgroundColor: brandColor, borderColor: brandColor }
                        : undefined
                    }
                  >
                    {num}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Contact fields */}
        <div className="mt-8 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Name (optional)
            </Label>
            <Input
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Email (optional)
            </Label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Phone (optional)
            </Label>
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <Button
          className="mt-6 w-full text-white"
          size="lg"
          onClick={handleSubmit}
          disabled={score == null || submitMutation.isPending}
          style={{ backgroundColor: brandColor }}
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Feedback'
          )}
        </Button>

      </Card>
    </BrandedPublicLayout>
  )
}
