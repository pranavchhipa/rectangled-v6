'use client'

/**
 * Hotfix PRD §4.5 — Branded layout for public QR pages.
 *
 * Wraps every screen on `/j/{slug}` and `/f/{slug}` with a branded
 * header (logo + display name on a brand-colored background) and a
 * branded footer (white-label-aware "Powered by" tagline). Content
 * stays in the middle, vertically centered as before.
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
 */

import type { PublicBranding } from '@rectangled/shared'

export function BrandedPublicLayout({
  branding,
  children,
  topSlot,
}: {
  branding: PublicBranding
  children: React.ReactNode
  /**
   * Optional slot rendered above the branded header. Used by the §3
   * preview-mode banner so it sits at the very top of the viewport.
   */
  topSlot?: React.ReactNode
}) {
  // Inline style carries the brand color into a CSS variable so child
  // components can pick it up without prop-drilling. Avoids tailwind's
  // arbitrary-value purge issues by NOT generating dynamic class names.
  const cssVars = { ['--brand' as string]: branding.brandColor } as React.CSSProperties

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={cssVars}>
      {topSlot}

      {/* Branded header. Brand color is rendered via inline style so it
          works for any owner-supplied hex without Tailwind purge. */}
      <header
        role="banner"
        className="flex items-center gap-3 px-4 py-3 text-white shadow-sm"
        style={{ backgroundColor: branding.brandColor }}
      >
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            className="size-11 rounded-md bg-white/95 object-contain p-0.5 shadow"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/15 text-base font-bold uppercase"
          >
            {branding.displayName.trim().charAt(0) || '?'}
          </div>
        )}
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight">
          {branding.displayName}
        </h1>
      </header>

      {/* Main — vertically centers the customer-facing card just like
          the unbranded layout did. flex-1 fills remaining viewport. */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Branded footer. White-labeled orgs show their footerText here
          (resolved server-side); everyone else sees "Powered by
          rectangled.io". */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        {branding.poweredByText}
      </footer>
    </div>
  )
}
