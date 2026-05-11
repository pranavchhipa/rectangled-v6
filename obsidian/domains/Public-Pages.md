---
type: domain
aliases: [Public Pages, Branded Layout, j and f Pages]
---

# Public Pages

The unauthenticated customer-facing routes — `/j/[slug]` and `/f/[slug]`. They share the **BrandedPublicLayout** shell. The owner-facing builder is in [[Surveys]].

## Surface
- Routes: `apps/web/src/app/j/[slug]/page.tsx`, `apps/web/src/app/f/[slug]/page.tsx`
- Layout shell: `apps/web/src/components/public/branded-layout.tsx`
- Inner widgets: `MetricInput`, `HappyPrompt`, `UnhappyFeedback`, `NpsInput`, `CsatInput`, `CesInput` — all in `apps/web/src/components/public/`
- Engine: `apps/api/src/surveys/`
- Branding helper: `apps/api/src/surveys/branding.helper.ts`
- Branding types: `packages/shared/src/types/branding.ts`

## Layout shell (post Hotfix-8)
- Top: navy `#11224f` header, concentric ring SVG from bottom-center, `minHeight: min(22vh, 180px)` mobile / `~32vh` sm:
- Bottom: white card with curved top (`border-top-radius: 50% 50px`) + tiled topographic wavy contour SVG; `flex-1` fills viewport
- Logo: 124px mobile / 152px sm: white circle with brand-color inner ring, straddling the boundary
- Cursive fallback (when no logo): split `displayName` on `" — "` and use the **location** half (Hotfix-9). E.g. "Pranav's Business — Woof Nest" → "woof".
- Footer: `branding.poweredByText`. If equals system default → render rectangled.io speech-bubble brand mark; otherwise plain text ([[White-Label]]).

## CSS var contract
Layout exposes on outer div:
- `--brand` — owner's brand color (logo border + buttons + selected states)
- `--navy` — `#11224f` shared header dark color
- `--gold` — `#d4af37` star outline color (CSAT)

**Inner components MUST use inline `style={{ ... }}`** — Tailwind arbitrary values like `bg-[var(--brand)]` purge unreliably in production.

## Critical don'ts
- No `?style=` switcher (Hotfix-8 owner-rejected — see [[Hotfix-Trail]])
- No `ringColor` (use `boxShadow: '0 0 0 2px #fff, 0 0 0 4px <color>'`)
- Mobile-first sizing always: `mobile-value sm:desktop-value`. iPhone SE (375×667) is the constraint — see [[Mobile-First-Design]]

## Local preview
Standalone HTML file (Pranav's Downloads):
`C:\Users\Pranav\Downloads\rectangled-public-page-designs.html` — single 420×880 iPhone with live controls. **Update this when changing production design**.

## Journey A happy-YES (Phase 1, `0eee598`)

When the customer clicks YES in [[Public-Pages|/j/{slug}]] `HappyPrompt`:

1. `handleHappyYes` calls `trpc.survey.generateHappyReviewDraft` with the journey id + score + metric.
2. The returned AI text is written to `navigator.clipboard` (falls back to `screen.reviewTemplate` if the mutation errors).
3. `submitLegacyJourney` records `{ acceptedReviewPrompt: true, redirectedTo: platform }`.
4. `window.open(redirectUrl)` to the external review platform — Journey A ends here. See [[Customer-Journeys]] Step 3a.1.

There is a small helper line under the YES button: *"An AI-generated review will be copied for you to paste"* so the clipboard hand-off isn't a surprise.

## Phase 2 — workspace redirect URLs

`screen.redirectLinks` now includes URLs the owner set during [[Onboarding]]'s Step 4 (`workspaces.settings.defaultRedirectLinks`), merged with the survey-step's explicit URL. If the customer's chosen `settings.reviewPlatform` doesn't have a survey-step URL, the workspace default fills in. See [[Onboarding]] for the gate.

## Connects to
- [[Surveys]] — engine, branding helper, screens
- [[Branding-Resolution]] — full chain
- [[White-Label]] — footer override
- [[Mobile-First-Design]] — sizing pattern
- [[Hotfix-Trail]] — chronology of how this got here
- [[QR]] — the QR points here
- [[Customer-Journeys]] — full flow map (every step + data dependency)
- [[OpenRouter]] — Phase 1 happy-review AI draft
- [[Onboarding]] — Phase 2 redirect-URL source
