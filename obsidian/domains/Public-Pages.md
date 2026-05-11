---
type: domain
aliases: [Public Pages, Branded Layout, j and f Pages]
---

# Public Pages

The unauthenticated customer-facing routes — `/j/[slug]` (journeys) and `/f/[slug]` (truforms). Both are thin wrappers around the shared step-walker renderer. The owner-facing builder is in [[Surveys]].

## Surface
- Routes: `apps/web/src/app/j/[slug]/page.tsx`, `apps/web/src/app/f/[slug]/page.tsx` — both delegate to `SurveyEngineRenderer`
- Renderer: `apps/web/src/components/public/survey-engine-renderer.tsx` — walks the survey step graph, one step at a time, via `trpc.survey.getInitialState` → `advance` → `complete`
- Layout shell: `apps/web/src/components/public/branded-layout.tsx`
- Engine: `apps/api/src/surveys/survey-engine.service.ts`
- Branding helper: `apps/api/src/surveys/branding.helper.ts`
- Branding types: `packages/shared/src/types/branding.ts`

## Step walker (Path B, commit `1524fb6`)

The renderer is generic — it never knows about specific step kinds at the route level. On mount it calls `getInitialState({ slug, preview })` and receives the first step + branding + sessionId. Each user action calls `advance({ surveyId, sessionId, fromStepId, answer, metricShown?, metricScore? })`. The engine auto-traverses through internal-only branch steps (`branch_by_score`, `branch_by_answer`) so the FE only ever receives renderable steps. When `advance` returns `{ done: true }`, the FE calls `complete({ finalState })` to persist the response.

Six per-step render components:
- `MetricStep` — CSAT stars / NPS-CES-NEV-CLI scale buttons
- `QuestionStep` — text / textarea / select / multi-select / rating / yes_no
- `MessageStep` — title + body + Continue
- `ContactStep` — name / email / phone fields per config
- `RedirectStep` — Yes/No prompt with AI clipboard hand-off
- `TerminalScreen` — final thank-you, shown after `complete()` returns

`<StepRenderer key={currentStep.id}>` forces remount per step so per-step local input state (textarea text, multi-select chips, contact fields, etc.) resets cleanly between steps.

## State accumulators via refs (commit `1a013e6`)

All cross-step state — `metricShown`, `metricScore`, `answers`, `contact`, `redirectedTo`, `acceptedReviewPrompt` — is mirrored into `useRef` in addition to React state. The submit handlers update the ref synchronously, and `finish()` reads from the refs when calling `complete()`. This defeats a stale-closure trap where the contact form (the last user-facing step before terminal) had its data lost because `setContact` hadn't settled before `finish` was invoked in the same tick.

## Retry-from-error UX

`walkerError` banner surfaces transient `advance` / `complete` failures with a "Try again" link that re-runs the last submit (`lastAction` tracks the most recent metric/question/message/contact/redirect interaction). Errors clear on successful step advance so the banner doesn't linger.

## Layout shell
- Top: navy `#11224f` header, concentric ring SVG from bottom-center, `minHeight: min(22vh, 180px)` mobile / `~32vh` sm:
- Bottom: white card with curved top (`border-top-radius: 50% 50px`) + tiled topographic wavy contour SVG; `flex-1` fills viewport
- Logo: 124px mobile / 152px sm: white circle with brand-color inner ring, straddling the boundary
- Cursive fallback (no logo): split `displayName` on `" — "` and use the **location** half (Hotfix-9). "Pranav's Business — Woof Nest" → "woof"
- Footer: `branding.poweredByText`. Default → render rectangled.io speech-bubble brand mark; non-default → plain text ([[White-Label]])

## CSS var contract
Outer div exposes:
- `--brand` — owner's brand color (buttons, selected states, logo ring)
- `--navy` — `#11224f` shared header dark color
- `--gold` — `#d4af37` star outline color (CSAT)

**Inner components MUST use inline `style={{ ... }}`** — Tailwind arbitrary values like `bg-[var(--brand)]` purge unreliably in production.

## Critical don'ts
- No `?style=` switcher (owner-rejected — see [[Hotfix-Trail]])
- No `ringColor` (use `boxShadow: '0 0 0 2px #fff, 0 0 0 4px <color>'`)
- Mobile-first sizing always: `mobile-value sm:desktop-value`. iPhone SE (375×667) is the constraint — see [[Mobile-First-Design]]

## Preview mode

`?preview=true` propagates through every engine call. Server-side: drops the `status='active'` filter (so draft surveys can be walked), skips `survey_starts` insertion, short-circuits `complete()` with no writes. FE renders an amber banner above the layout.

## Happy-YES AI clipboard (Phase 1, `0eee598`)

In `RedirectStep`, clicking YES calls `trpc.survey.generateHappyReviewDraft({ journeyId, metricShown, metricScore })` BEFORE the redirect — the returned AI text is written to `navigator.clipboard`. Falls back to the step's static `reviewTemplate` if the call fails. Helper line under YES: *"An AI-generated review will be copied for you to paste"*.

## Workspace redirect URL merge (Phase 2)

`screen.redirectLinks` merges `workspaces.settings.defaultRedirectLinks` (set during [[Onboarding]] Step 4) with the survey-step's explicit URL. Survey-step value wins per platform; workspace defaults fill gaps.

## Connects to
- [[Surveys]] — engine that drives the walker
- [[Customer-Journeys]] — full flow map per branch
- [[Branding-Resolution]] — branding chain
- [[White-Label]] — footer override
- [[Mobile-First-Design]] — sizing pattern
- [[Hotfix-Trail]] — chronology
- [[QR]] — the QR points here
- [[OpenRouter]] — Phase 1 happy-YES draft
- [[Onboarding]] — Phase 2 redirect URLs
