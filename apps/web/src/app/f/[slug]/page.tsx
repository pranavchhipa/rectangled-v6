'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Star, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
// Hotfix-8 — Label/Input imports dropped; we now use plain <input>
// elements with inline focus handlers so the brand-color border focus
// state can be applied without prop-drilling. Card/Skeleton stay for
// loading + error states.
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
  // Hotfix-8 — Afraa-style. Navy-bordered scale buttons with brand-color
  // selected state. Uniform look (no red/amber/green tinting).
  // Hotfix-9 — mobile-first sizing.
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <p
        className="text-center text-[20px] font-extrabold leading-[1.15] tracking-tight sm:text-[26px]"
        style={{ color: 'var(--navy)' }}
      >
        How likely are you to recommend us to a friend?
      </p>
      <p
        className="text-center text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
        style={{ color: 'var(--navy)', opacity: 0.55 }}
      >
        NPS
      </p>
      <div className="grid grid-cols-11 gap-0.5 pt-2 sm:gap-1.5 sm:pt-3">
        {Array.from({ length: 11 }).map((_, i) => {
          const isSelected = value === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className="flex aspect-square items-center justify-center rounded-lg border-2 text-[11px] font-bold transition-all hover:scale-105 sm:text-base"
              style={
                isSelected
                  ? {
                      backgroundColor: brandColor,
                      borderColor: brandColor,
                      color: '#fff',
                      transform: 'scale(1.1)',
                      boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${brandColor}`,
                    }
                  : {
                      backgroundColor: '#fff',
                      borderColor: 'rgba(17, 34, 79, 0.15)',
                      color: 'var(--navy)',
                    }
              }
            >
              {i}
            </button>
          )
        })}
      </div>
      <div
        className="flex justify-between px-1 text-[10px] font-semibold sm:text-[11px]"
        style={{ color: 'var(--navy)', opacity: 0.55 }}
      >
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

  // Hotfix-8 — Afraa-style. Gold outlined stars by default, brand-color
  // fill on hover/select. Big navy heading + small uppercase metric label.
  // Hotfix-9 — mobile-first sizing.
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <p
        className="text-center text-[20px] font-extrabold leading-[1.15] tracking-tight sm:text-[26px]"
        style={{ color: 'var(--navy)' }}
      >
        How was your experience with us?
      </p>
      <p
        className="text-center text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
        style={{ color: 'var(--navy)', opacity: 0.55 }}
      >
        CSAT
      </p>
      <div className="flex justify-center gap-2 py-1 sm:gap-4 sm:py-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const starNum = i + 1
          const isFilled =
            hoveredStar != null
              ? starNum <= hoveredStar
              : value != null && starNum <= value

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(starNum)}
              onMouseEnter={() => setHoveredStar(starNum)}
              onMouseLeave={() => setHoveredStar(null)}
              className="transition-transform hover:scale-110"
              aria-label={`${starNum} star${starNum > 1 ? 's' : ''}`}
            >
              <Star
                className="size-9 sm:size-12"
                style={
                  isFilled
                    ? { fill: brandColor, color: brandColor }
                    : { color: 'var(--gold)' }
                }
                strokeWidth={1.5}
              />
            </button>
          )
        })}
      </div>
      <div
        className="flex justify-between px-2 text-[10px] font-semibold sm:text-[11px]"
        style={{ color: 'var(--navy)', opacity: 0.55 }}
      >
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

  // Hotfix-8 — Afraa-style. Same scale treatment as NPS but 7-point.
  // Hotfix-9 — mobile-first sizing.
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <p
        className="text-center text-[20px] font-extrabold leading-[1.15] tracking-tight sm:text-[26px]"
        style={{ color: 'var(--navy)' }}
      >
        How easy was it to get what you needed today?
      </p>
      <p
        className="text-center text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
        style={{ color: 'var(--navy)', opacity: 0.55 }}
      >
        CES
      </p>
      <div className="grid grid-cols-7 gap-1 pt-2 sm:gap-1.5 sm:pt-3">
        {Array.from({ length: 7 }).map((_, i) => {
          const num = i + 1
          const isSelected = value === num

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(num)}
              className="flex aspect-square items-center justify-center rounded-lg border-2 text-[12px] font-bold transition-all hover:scale-105 sm:text-[14px] sm:p-3"
              style={
                isSelected
                  ? {
                      backgroundColor: brandColor,
                      borderColor: brandColor,
                      color: '#fff',
                      transform: 'scale(1.1)',
                      boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${brandColor}`,
                    }
                  : {
                      backgroundColor: '#fff',
                      borderColor: 'rgba(17, 34, 79, 0.15)',
                      color: 'var(--navy)',
                    }
              }
            >
              {num}
            </button>
          )
        })}
      </div>
      <div
        className="flex justify-between px-1 text-[10px] font-semibold sm:text-[11px]"
        style={{ color: 'var(--navy)', opacity: 0.55 }}
      >
        <span>Very Difficult</span>
        <span>Very Easy</span>
      </div>
    </div>
  )
}

export default function PublicFormPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  // Hotfix-2 — preview mode parity with /j/{slug}. Owners can open
  // /f/{slug}?preview=true on a draft deep survey to walk it before
  // activating; the engine drops the active-status filter when preview
  // is true. Submit endpoints already no-op persistence on preview.
  const isPreview = searchParams?.get('preview') === 'true'

  const [score, setScore] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Phase 5 — reads now come from the survey engine (legacy shape).
  // truform.getPublic was removed when the legacy tables dropped.
  const formQuery = trpc.survey.getPublicLegacyTruform.useQuery(
    { slug, preview: isPreview },
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
        {/* Hotfix-8 — Afraa-style thank-you. Brand-color celebration ring,
            navy heading.
            Hotfix-9 — mobile-first sizing. */}
        <div className="text-center">
          <div
            className="mx-auto flex size-16 items-center justify-center rounded-full sm:size-20"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--brand) 15%, white)',
            }}
          >
            <CheckCircle2 className="size-8 sm:size-10" style={{ color: 'var(--brand)' }} />
          </div>
          <h2
            className="mt-4 text-[24px] font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-[28px]"
            style={{ color: 'var(--navy)' }}
          >
            Thank You!
          </h2>
          <p
            className="mt-2 text-[14px] font-medium sm:text-[15px]"
            style={{ color: 'var(--navy)', opacity: 0.7 }}
          >
            {thankYouMessage}
          </p>
        </div>
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
      {/* Hotfix-8 — Afraa-style. Form name as small uppercase label
          (since BrandedPublicLayout already shows the BUSINESS name in
          the navy header). Score input + contact fields + submit all
          tinted to navy/brand palette. */}
      <div>
        {/* Form name as eyebrow + scoring instruction.
            Hotfix-9 — tighter spacing on mobile. */}
        {form.name && (
          <p
            className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.22em] sm:mb-4 sm:text-[11px]"
            style={{ color: 'var(--navy)', opacity: 0.5 }}
          >
            {form.name}
          </p>
        )}

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
          <div className="space-y-2.5 sm:space-y-3">
            <p
              className="text-center text-[20px] font-extrabold leading-[1.15] tracking-tight sm:text-[26px]"
              style={{ color: 'var(--navy)' }}
            >
              Rate your experience
            </p>
            <p
              className="text-center text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
              style={{ color: 'var(--navy)', opacity: 0.55 }}
            >
              1 – 10
            </p>
            <div className="grid grid-cols-5 gap-1 pt-2 sm:grid-cols-10 sm:gap-1.5 sm:pt-3">
              {Array.from({ length: 10 }).map((_, i) => {
                const num = i + 1
                const isSelected = score === num
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setScore(num)}
                    className="flex aspect-square items-center justify-center rounded-lg border-2 text-[12px] font-bold transition-all hover:scale-105 sm:size-11 sm:text-[14px]"
                    style={
                      isSelected
                        ? {
                            backgroundColor: brandColor,
                            borderColor: brandColor,
                            color: '#fff',
                            transform: 'scale(1.1)',
                            boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${brandColor}`,
                          }
                        : {
                            backgroundColor: '#fff',
                            borderColor: 'rgba(17, 34, 79, 0.15)',
                            color: 'var(--navy)',
                          }
                    }
                  >
                    {num}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Contact fields — navy-bordered, brand focus.
            Hotfix-9 — tighter spacing + smaller h on mobile. */}
        <div className="mt-5 space-y-2 sm:mt-8 sm:space-y-3">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] sm:text-[11px]"
            style={{ color: 'var(--navy)', opacity: 0.5 }}
          >
            Optional — your details
          </p>
          {[
            {
              type: 'text' as const,
              placeholder: 'Your name',
              value: customerName,
              onChange: setCustomerName,
            },
            {
              type: 'email' as const,
              placeholder: 'your@email.com',
              value: customerEmail,
              onChange: setCustomerEmail,
            },
            {
              type: 'tel' as const,
              placeholder: '+91 98765 43210',
              value: customerPhone,
              onChange: setCustomerPhone,
            },
          ].map((f, i) => (
            <input
              key={i}
              type={f.type}
              className="h-10 w-full rounded-xl border-2 bg-white px-3.5 text-[13px] transition-colors focus:outline-none sm:h-12 sm:px-4 sm:text-[14px]"
              style={{
                borderColor: 'rgba(17, 34, 79, 0.15)',
                color: 'var(--navy)',
              }}
              placeholder={f.placeholder}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'var(--brand)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = 'rgba(17, 34, 79, 0.15)')
              }
            />
          ))}
        </div>

        {/* Submit */}
        <Button
          className="mt-4 h-12 w-full rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 sm:mt-6 sm:h-14 sm:text-[15px]"
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
      </div>
    </BrandedPublicLayout>
  )
}
