'use client'

/**
 * Hotfix PRD §4.5 + §8 — Branded layout for public QR pages.
 *
 * Wraps every screen on `/j/{slug}` and `/f/{slug}` with the same
 * customer-facing shell:
 *
 *   ┌──────────────────────────────────┐
 *   │ Top: navy with concentric rings  │  ← branding.displayName
 *   │  emanating from bottom-center.   │
 *   │     ╲                            │
 *   │      ╲ curved boundary           │
 *   │  ┌───╲──────╲──────────────┐    │
 *   │  │  ●LOGO●  (152px circle, │    │  ← branding.logoUrl OR
 *   │  │  straddles boundary)    │    │     cursive displayName fallback
 *   │  │                          │    │
 *   │  │  {children}              │    │  ← journey/truform content
 *   │  │  (question + scale +     │    │
 *   │  │   button stays here)     │    │
 *   │  │                          │    │
 *   │  │  Powered By              │    │  ← branding.poweredByText
 *   │  │  [bubble] rectangled.io  │    │     (or white-label override)
 *   │  └──────────────────────────┘    │
 *   └──────────────────────────────────┘
 *
 * The `branding` prop comes from the public engine's GET response
 * (`getPublicLegacyJourney` / `getPublicLegacyTruform` /
 * `adaptive.getInitialState`). Resolution rules live server-side in
 * `apps/api/src/surveys/branding.helper.ts` (location → workspace →
 * defaults) so the renderer is a pure consumer.
 *
 * Hotfix-8 history — replaced the prior 4-style switcher (`?style=`) with
 * a single premium Afraa-inspired design after owner feedback. Patterns:
 *   - Dark navy header (#11224f) with concentric ring SVG emanating from
 *     bottom-center → suggests focus / brand presence.
 *   - White card with soft elliptical curved-top boundary
 *     (`border-top-radius: 50% 50px`) and tiled topographic wave SVG.
 *   - Logo at `top: -76px` of the white card, 152px circle, white outer
 *     padding + brand-color inner ring + Cormorant Garamond italic
 *     cursive fallback when no logoUrl.
 *   - Powered By renders as the rectangled.io speech-bubble brand mark
 *     + wordmark unless white-labeled (then plain text).
 *
 * Accessibility:
 *   - Header is `<header role="banner">` with `<h1>` displayName.
 *   - Logo `<img>` carries empty alt (decorative).
 *   - Brand color exposed as `--brand` CSS var so descendants can use
 *     `var(--brand)` without prop-drilling.
 *   - All interactive elements keep min-height ≥44px (iOS HIG).
 *   - Motion: only 150ms transitions on hover, no continuous animation.
 */

import type { PublicBranding } from '@rectangled/shared'
import { DEFAULT_POWERED_BY_TEXT } from '@rectangled/shared'

interface Props {
  branding: PublicBranding
  children: React.ReactNode
  /**
   * Optional slot rendered above the branded header. Used by the §3
   * preview-mode banner so it sits at the very top of the viewport.
   */
  topSlot?: React.ReactNode
}

// Header navy is currently fixed (Afraa palette default). A future
// hotfix will lift this into per-workspace branding (e.g. owners on
// brands that clash with navy can pick another dark color).
const HEADER_NAVY = '#11224f'

// Concentric rings emanating from bottom-center of the navy header.
// 7 circles, white at 13% opacity, 1.4px stroke. Encoded inline so no
// external asset fetch on the public page (latency-sensitive).
const RINGS_BG =
  "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 340' preserveAspectRatio='xMidYMax meet'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.13)' stroke-width='1.4'%3E%3Ccircle cx='210' cy='340' r='90'/%3E%3Ccircle cx='210' cy='340' r='140'/%3E%3Ccircle cx='210' cy='340' r='190'/%3E%3Ccircle cx='210' cy='340' r='240'/%3E%3Ccircle cx='210' cy='340' r='290'/%3E%3Ccircle cx='210' cy='340' r='340'/%3E%3Ccircle cx='210' cy='340' r='390'/%3E%3C/g%3E%3C/svg%3E\")"

// Topographic wavy contour lines, tiled. Slate at 8% opacity, 200px
// tile. Adds organic texture to the white card without competing with
// content readability.
const WAVES_BG =
  "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cg fill='none' stroke='rgba(17,34,79,0.08)' stroke-width='1'%3E%3Cpath d='M -20 30 Q 30 10 80 30 T 180 30 T 280 30'/%3E%3Cpath d='M -20 60 Q 30 40 80 60 T 180 60 T 280 60'/%3E%3Cpath d='M -20 90 Q 30 70 80 90 T 180 90 T 280 90'/%3E%3Cpath d='M -20 120 Q 30 100 80 120 T 180 120 T 280 120'/%3E%3Cpath d='M -20 150 Q 30 130 80 150 T 180 150 T 280 150'/%3E%3Cpath d='M -20 180 Q 30 160 80 180 T 180 180 T 280 180'/%3E%3C/g%3E%3C/svg%3E\")"

export function BrandedPublicLayout({ branding, children, topSlot }: Props) {
  const brand = branding.brandColor

  // Cursive fallback (when no logoUrl uploaded). Source priority:
  //   1. workspaceName — never includes location suffix; cleanest
  //      when the displayName resolves to "Workspace — Location"
  //      composite. We want the LOCATION's branding to lead, so we
  //      actually prefer the location half when present.
  //   2. If displayName has " — " separator (from branding.helper.ts
  //      single-location fallthrough), use the part AFTER the dash
  //      (location name). Otherwise use displayName as-is.
  // Then take first word, lowercase. For "Pranav's Business — Woof
  // Nest" → "woof". For "Woof Nest" alone → "woof". For "Afraa Lounge
  // & Restaurant" → "afraa".
  const cursiveSource = branding.displayName.includes(' — ')
    ? branding.displayName.split(' — ').slice(1).join(' — ').trim()
    : branding.displayName
  const cursiveFallback =
    cursiveSource.trim().split(/\s+/)[0]?.toLowerCase() || '?'

  // Inline CSS vars so descendants can use `var(--brand)`, `var(--navy)`,
  // `var(--gold)` without prop-drilling. Avoids tailwind arbitrary-value
  // purge on dynamic owner-supplied colors.
  //   --brand: owner's logo border + accent + button color
  //   --navy:  shared header dark color (currently fixed; future hotfix
  //            lifts to per-workspace setting)
  //   --gold:  star outline color in CSAT-stars rendering
  const cssVars = {
    ['--brand' as string]: brand,
    ['--navy' as string]: HEADER_NAVY,
    ['--gold' as string]: '#d4af37',
  } as React.CSSProperties

  // White-label detection: the helper replaces the default tagline with
  // org-specific text. We only show the styled rectangled.io mark when
  // it's the system default; otherwise we render the plain text the
  // org configured.
  const isRectangledFooter =
    branding.poweredByText === DEFAULT_POWERED_BY_TEXT

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: HEADER_NAVY, ...cssVars }}
    >
      {topSlot}

      {/* Top: navy header with concentric rings.
          Hotfix-9 — mobile-first sizing. Was minHeight: 36vh which on
          iPhone SE (667px) ate 240px and overflowed the viewport with
          page scroll. Now 22vh mobile / 32vh sm: keeps the whole
          experience inside one screen on small phones. */}
      <header
        role="banner"
        className="relative px-6 pb-5 pt-10 sm:px-7 sm:pb-7 sm:pt-14"
        style={{
          backgroundColor: HEADER_NAVY,
          backgroundImage: RINGS_BG,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'bottom center',
          minHeight: 'min(22vh, 180px)',
        }}
      >
        <h1 className="z-10 text-[22px] font-bold leading-[1.2] tracking-tight text-white sm:text-[28px] sm:leading-[1.15] md:text-[30px]">
          {branding.displayName}
        </h1>
      </header>

      {/* Bottom: white card with curved top + waves + content.
          Hotfix-9 — pt-20 mobile, pt-24 sm: (less padding above logo
          on small phones to claw back vertical space). */}
      <main
        className="relative -mt-6 flex flex-1 flex-col items-center bg-white px-5 pb-4 pt-20 sm:px-6 sm:pb-5 sm:pt-24"
        style={{
          borderTopLeftRadius: '50% 50px',
          borderTopRightRadius: '50% 50px',
          backgroundImage: WAVES_BG,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      >
        {/* Logo straddling the boundary.
            Hotfix-9 — 124px on mobile, 152px on sm:. Smaller circle
            keeps the negative-margin overlap from eating the navy
            title on small phones. */}
        <div
          className="absolute left-1/2 z-20 size-[124px] -translate-x-1/2 -translate-y-[62px] rounded-full bg-white p-1.5 sm:size-[152px] sm:-translate-y-[76px] sm:p-2"
          style={{
            top: 0,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
          }}
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full p-3"
            style={{ border: `3px solid ${brand}` }}
          >
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span
                className="text-[30px] font-bold italic leading-none lowercase sm:text-[36px]"
                style={{
                  color: brand,
                  fontFamily:
                    '"Cormorant Garamond", "Brush Script MT", serif',
                  letterSpacing: '-0.02em',
                }}
              >
                {cursiveFallback}
              </span>
            )}
          </div>
        </div>

        {/* Children — the journey/truform renderer's content. Q + scale
            + button stack lives here. mt-4 nudges below the logo's
            shadow tail. */}
        <div className="z-10 mt-4 w-full max-w-md">{children}</div>

        {/* Powered By footer (pinned to bottom of white card).
            Hotfix-9 — tighter top padding on mobile. */}
        <div className="z-10 mt-auto flex flex-col items-center pt-5 pb-1 sm:pt-8 sm:pb-2">
          {isRectangledFooter ? (
            <>
              <p className="text-[11px] font-medium text-slate-600 sm:text-[13px]">
                Powered By
              </p>
              <div className="mt-1 flex items-center gap-1.5 sm:mt-1.5">
                {/* rectangled.io brand mark — speech-bubble with two
                    upward arches inside, dark navy fill */}
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M 16 8 H 84 Q 92 8 92 16 V 60 Q 92 68 84 68 H 60 L 50 84 L 50 68 H 16 Q 8 68 8 60 V 16 Q 8 8 16 8 Z"
                    fill={HEADER_NAVY}
                  />
                  <path
                    d="M 30 42 Q 36 30 42 42"
                    stroke="white"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 58 42 Q 64 30 70 42"
                    stroke="white"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="text-[15px] font-bold tracking-tight sm:text-[18px]"
                  style={{ color: HEADER_NAVY }}
                >
                  rectangled.io
                </span>
              </div>
            </>
          ) : (
            // White-labeled orgs see their custom footerText as plain
            // text (no rectangled.io branding).
            <p className="text-[11px] font-medium text-slate-600 sm:text-[13px]">
              {branding.poweredByText}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
