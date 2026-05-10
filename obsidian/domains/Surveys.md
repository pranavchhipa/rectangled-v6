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
- Web (builder): `apps/web/src/app/dashboard/journeys/`, `apps/web/src/app/dashboard/journeys/[id]/`, `apps/web/src/app/dashboard/surveys/`, `apps/web/src/components/surveys/`
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

## Connects to
- [[Public-Pages]] — what users see at `/j` and `/f`
- [[QR]] — the QR generator embeds the slug
- [[Branding-Resolution]] — engine resolves branding before serving
- [[Customers]] — survey responses link to customer rows
- [[Reviews]] — happy-path branch can prompt for an external review
- [[Escalations]] — unhappy-path branch can fire CX rules
- [[NEV]] — emotion vector inputs come from survey responses
- [[Business-Aspects]] — aspect chips on responses
- [[Hotfix-Trail]]
