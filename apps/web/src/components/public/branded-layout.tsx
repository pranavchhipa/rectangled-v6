'use client'

/**
 * Hotfix PRD §4.5 — Branded layout for public QR pages.
 *
 * Wraps every screen on `/j/{slug}` and `/f/{slug}` with a branded
 * shell (logo + display name on a brand-colored surface) and a
 * subtle footer (white-label-aware "Powered by" tagline). Customer-
 * facing content sits in the middle.
 *
 * Hotfix-7 — visual refactor. The previous version was a thin
 * horizontal header strip + bare card; multiple owners flagged it as
 * "boring / generic". This version ships FOUR mobile-first style
 * variants, switchable via `?style=1|2|3|4`. Default is `1`. Owners
 * append the param to the QR URL to compare; once they pick one, we
 * lift it to a per-workspace branding setting (future hotfix).
 *
 *   1. Hero Gradient   — brand→fade gradient, big circular logo halo
 *   2. Glass Brand     — solid brand bg, frosted-glass card overlay
 *   3. Editorial Clean — pure white minimal, small horizontal header
 *   4. Polaroid Warm   — tinted bg, single card with logo embedded
 *
 * The `branding` prop comes from the public engine's GET response
 * (`getPublicLegacyJourney` / `getPublicLegacyTruform` /
 * `adaptive.getInitialState`). Resolution rules live server-side in
 * `apps/api/src/surveys/branding.helper.ts` (location → workspace →
 * defaults) so the renderer is a pure consumer.
 *
 * Accessibility:
 *   - Header is `<header role="banner">` with the display name as
 *     `<h1>`, so screen readers announce the business once.
 *   - Logo `<img>` carries an empty alt because the display name is
 *     already textual; the logo is decorative in this context.
 *   - Brand color is exposed as a CSS custom property `--brand` so
 *     descendant components (e.g. NPS button highlights in the
 *     truform renderer) can reference `var(--brand)` without prop-
 *     drilling.
 *   - All interactive elements keep min-height ≥44px (iOS HIG).
 */

import { useSearchParams } from 'next/navigation'
import type { PublicBranding } from '@rectangled/shared'

type Style = '1' | '2' | '3' | '4'

interface Props {
  branding: PublicBranding
  children: React.ReactNode
  /**
   * Optional slot rendered above the branded header. Used by the §3
   * preview-mode banner so it sits at the very top of the viewport.
   */
  topSlot?: React.ReactNode
}

export function BrandedPublicLayout({ branding, children, topSlot }: Props) {
  const searchParams = useSearchParams()
  const raw = searchParams?.get('style') ?? '1'
  const style: Style = raw === '2' || raw === '3' || raw === '4' ? raw : '1'

  switch (style) {
    case '2':
      return <Style2GlassBrand branding={branding} topSlot={topSlot}>{children}</Style2GlassBrand>
    case '3':
      return <Style3EditorialClean branding={branding} topSlot={topSlot}>{children}</Style3EditorialClean>
    case '4':
      return <Style4PolaroidWarm branding={branding} topSlot={topSlot}>{children}</Style4PolaroidWarm>
    case '1':
    default:
      return <Style1HeroGradient branding={branding} topSlot={topSlot}>{children}</Style1HeroGradient>
  }
}

// ============================================================
// Shared primitives
// ============================================================

function LogoMark({
  branding,
  size,
  rounded,
  ringStyle,
  textColor,
}: {
  branding: PublicBranding
  size: number // px
  rounded: 'full' | '2xl' | 'lg'
  ringStyle?: React.CSSProperties
  textColor?: string
}) {
  const initial = branding.displayName.trim().charAt(0).toUpperCase() || '?'
  const radius =
    rounded === 'full' ? 'rounded-full' : rounded === '2xl' ? 'rounded-2xl' : 'rounded-lg'

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt=""
        className={`${radius} bg-white object-contain`}
        style={{
          width: size,
          height: size,
          padding: size >= 80 ? 8 : size >= 60 ? 6 : 4,
          ...ringStyle,
        }}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center font-bold uppercase ${radius} bg-white`}
      style={{
        width: size,
        height: size,
        color: textColor ?? branding.brandColor,
        fontSize: size >= 80 ? 30 : size >= 60 ? 22 : 16,
        ...ringStyle,
      }}
    >
      {initial}
    </div>
  )
}

// ============================================================
// 1. Hero Gradient — branded, warm, the new default
// ============================================================

function Style1HeroGradient({ branding, children, topSlot }: Props) {
  const brand = branding.brandColor
  const cssVars = { ['--brand' as string]: brand } as React.CSSProperties

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background: `linear-gradient(180deg, ${brand} 0%, ${brand}AA 22%, ${brand}33 45%, #f8fafc 70%)`,
        ...cssVars,
      }}
    >
      {topSlot}

      <header role="banner" className="px-4 pb-6 pt-10 text-center sm:pt-14">
        <div className="mx-auto inline-block">
          <LogoMark
            branding={branding}
            size={96}
            rounded="full"
            ringStyle={{
              boxShadow: `0 0 0 6px rgba(255,255,255,0.35), 0 12px 28px -8px rgba(0,0,0,0.25)`,
            }}
          />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">
          {branding.displayName}
        </h1>
        <p className="mt-1 text-sm text-white/85">We'd love to hear from you</p>
      </header>

      <main className="flex-1 px-4 pb-6">
        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-100 sm:p-8">
          {children}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-500">
        {branding.poweredByText}
      </footer>
    </div>
  )
}

// ============================================================
// 2. Glass Brand — bold full-bleed, frosted card overlay
// ============================================================

function Style2GlassBrand({ branding, children, topSlot }: Props) {
  const brand = branding.brandColor
  const cssVars = { ['--brand' as string]: brand } as React.CSSProperties

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ backgroundColor: brand, ...cssVars }}
    >
      {/* Decorative blobs for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 size-48 rounded-full bg-white/5 blur-2xl" />
      </div>

      {topSlot}

      <header role="banner" className="relative px-4 pb-5 pt-10 text-center sm:pt-12">
        <div className="mx-auto inline-block">
          <LogoMark
            branding={branding}
            size={80}
            rounded="2xl"
            ringStyle={{
              boxShadow: `0 12px 24px -6px rgba(0,0,0,0.3)`,
            }}
            textColor={brand}
          />
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {branding.displayName}
        </h1>
      </header>

      <main className="relative flex-1 px-4 pb-6">
        <div
          className="mx-auto w-full max-w-md rounded-3xl border border-white/40 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {children}
        </div>
      </main>

      <footer className="relative py-4 text-center text-xs text-white/70">
        {branding.poweredByText}
      </footer>
    </div>
  )
}

// ============================================================
// 3. Editorial Clean — minimal Apple/Stripe-style
// ============================================================

function Style3EditorialClean({ branding, children, topSlot }: Props) {
  const brand = branding.brandColor
  const cssVars = { ['--brand' as string]: brand } as React.CSSProperties

  return (
    <div className="flex min-h-screen flex-col bg-white" style={cssVars}>
      {topSlot}

      <header role="banner" className="border-b border-slate-100 px-4 py-4">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <LogoMark
            branding={branding}
            size={40}
            rounded="lg"
            textColor="#fff"
            ringStyle={
              branding.logoUrl
                ? undefined
                : { backgroundColor: brand }
            }
          />
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-slate-900">
            {branding.displayName}
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        {branding.poweredByText}
      </footer>
    </div>
  )
}

// ============================================================
// 4. Polaroid Warm — single card, logo baked in, soft tinted bg
// ============================================================

function Style4PolaroidWarm({ branding, children, topSlot }: Props) {
  const brand = branding.brandColor
  const cssVars = { ['--brand' as string]: brand } as React.CSSProperties

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: `${brand}10`, ...cssVars }}
    >
      {topSlot}

      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100 sm:p-8">
            <header role="banner" className="mb-6 text-center">
              <div className="mx-auto inline-block">
                <LogoMark
                  branding={branding}
                  size={80}
                  rounded="full"
                  ringStyle={{
                    boxShadow: `0 0 0 4px ${brand}30, 0 6px 14px -4px rgba(0,0,0,0.15)`,
                  }}
                  textColor={brand}
                />
              </div>
              <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {branding.displayName}
              </h1>
              <div
                className="mx-auto mt-3 h-0.5 w-12 rounded-full opacity-40"
                style={{ backgroundColor: brand }}
              />
            </header>
            {children}
          </div>
        </div>
      </main>

      <footer className="py-3 text-center text-xs text-slate-500">
        {branding.poweredByText}
      </footer>
    </div>
  )
}
