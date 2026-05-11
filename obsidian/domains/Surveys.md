---
type: domain
aliases: [Surveys, Journeys, TruForms, Survey Engine]
---

# Surveys (Journeys + TruForms)

Internal feedback capture. Two flavors:
- **Journey** (`/j/[slug]`) — multi-screen branching flow (ask metric → branch on score → happy review prompt OR unhappy feedback → thank-you)
- **TruForm** (`/f/[slug]`) — single-screen NPS / CSAT / CES / custom 1-10

The live engine is **Survey Engine V2**.

## Surface
- API: `apps/api/src/surveys/` (engine, branding helper, screens)
- Web (builder, canonical): `apps/web/src/app/dashboard/journeys/page.tsx` — unified journeys/surveys list
- Web (builder, detail): `apps/web/src/app/dashboard/journeys/[id]/page.tsx`
- Web components: `apps/web/src/components/surveys/` (`create-custom-journey-wizard`, `decision-tree-editor`, `decision-tree-edit-panel`, `insert-step-modal`, `adaptive-settings-form`)

> **Refactor `79fa581`:** `/dashboard/surveys/*` was a 5-line redirect to `/dashboard/journeys` and got deleted. **Journeys is now the single surveys/journeys surface.**
- Web (public): `apps/web/src/app/j/[slug]/page.tsx`, `apps/web/src/app/f/[slug]/page.tsx` ([[Public-Pages]])
- DB: `packages/db/src/schema/surveys.ts`
- Validators: `packages/shared/src/validators/survey.ts`, `survey-steps.ts`, `survey-wizard.ts`
- Types: `packages/shared/src/types/survey-steps.ts`
- Constants: `packages/shared/src/constants/journey-metrics.ts`, `step-type-labels.ts`, `survey-branch-eval.ts`, `survey-step-builders.ts`
- Migration scripts: `scripts/migrate-journey-v2.mjs`, `scripts/backfill-surveys.mjs`

## Branching engine
Branch evaluation in `constants/survey-branch-eval.ts` (with `.test.ts` coverage).
Step builders in `constants/survey-step-builders.ts`.

## Public engine quirks
- `?preview=true` drops `status='active'` filter and skips persistence (used by builder preview).
- `submitLegacyJourneySchema.journeyScreenId` is `z.string().min(1).max(128)` (not UUID) because synthetic IDs `${surveyId}-screen` aren't UUIDs (Hotfix-4).
- `template !== 'deep'` is the right check, not `template === 'quick'` (Hotfix-3).

## Phase 1 — AI happy-review draft (`0eee598`)

New public mutation `trpc.survey.generateHappyReviewDraft`. Composed in `survey-engine.service.ts → generateHappyReviewDraft({ journeyId, metricShown?, metricScore? })`:
- Looks up the survey + workspace, resolves branding for business name + location half of `displayName`
- Calls [[OpenRouter]] (`openai/gpt-4o-mini` default) with a "write a short positive review for this business" prompt
- Falls back to `"Had a great experience at <name>!"` static template if `OPENROUTER_API_KEY` is missing or the call fails
- Wired into `/j/[slug]` `handleHappyYes` — called BEFORE submit + redirect, returned text goes to `navigator.clipboard`

## Phase 2 — workspace redirect-URL fallback (`29393f7`)

`getPublicLegacyJourney` now merges `workspaces.settings.defaultRedirectLinks` into `screen.redirectLinks`. Survey-step's explicit URL still wins per-platform; workspace defaults fill the gaps. Lets legacy surveys inherit the URLs set in [[Onboarding]] without re-saving each one.

## Connects to
- [[Public-Pages]] — what users see at `/j` and `/f`
- [[QR]] — the QR generator embeds the slug
- [[Branding-Resolution]] — engine resolves branding before serving
- [[Customers]] — survey responses link to customer rows
- [[Reviews]] — happy-path branch can prompt for an external review
- [[Escalations]] — unhappy-path branch can fire CX rules
- [[NEV]] — emotion vector inputs come from survey responses
- [[Business-Aspects]] — aspect chips on responses
- [[OpenRouter]] — Phase 1 happy-review draft generation
- [[Onboarding]] — Phase 2 redirect-URL source
- [[Customer-Journeys]] — every flow that touches this engine
- [[Hotfix-Trail]]
