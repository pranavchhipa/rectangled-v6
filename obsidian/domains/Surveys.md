---
type: domain
aliases: [Surveys, Journeys, TruForms, Survey Engine]
---

# Surveys (Journeys + TruForms)

Internal feedback capture. Unified data model with two URL surfaces:

- **Journey** (`/j/[slug]`) — multi-screen branching flow (templates: `quick`, `adaptive`, `custom`)
- **TruForm** (`/f/[slug]`) — single-screen on classical metrics (template: `deep`)

Both URL routes drive the SAME step engine — the route distinction is preserved only for printed QRs / historical bookmarks. The engine walks `surveys.steps[]` graph one step at a time; see [[Public-Pages]] for the FE renderer.

## Surface
- Engine: `apps/api/src/surveys/survey-engine.service.ts` — `getInitialState` / `advance` / `complete` + `generateHappyReviewDraft`
- Branding helper: `apps/api/src/surveys/branding.helper.ts`
- Router: `apps/api/src/surveys/survey.router.ts`
- Web (builder, canonical): `apps/web/src/app/dashboard/journeys/page.tsx` + `journeys/[id]/page.tsx`
- Web (public): wrappers at `apps/web/src/app/{j,f}/[slug]/page.tsx` → `apps/web/src/components/public/survey-engine-renderer.tsx`
- Web (editor components): `apps/web/src/components/surveys/` (`decision-tree-editor`, `create-custom-journey-wizard`, `insert-step-modal`, `adaptive-settings-form`)
- DB: `packages/db/src/schema/surveys.ts`
- Validators: `packages/shared/src/validators/survey.ts`, `survey-steps.ts`, `survey-wizard.ts`
- Types: `packages/shared/src/types/survey-steps.ts`
- Constants: `packages/shared/src/constants/journey-metrics.ts`, `step-type-labels.ts`, `survey-branch-eval.ts`, `survey-step-builders.ts`

## Step engine

`advance` auto-traverses internal-only branch steps (`branch_by_score`, `branch_by_answer`) so the FE only ever receives renderable steps. 32-hop traversal cap guards against cycles in user-built graphs. End-journey steps surface as `{ done: true, terminalStep }` so the FE knows to call `complete()` with that step's id for per-path coupon / triggerEvent / message resolution.

`getInitialState` returns the resolved first step + `branding` (full `PublicBranding` shape from [[Branding-Resolution]]) + `sessionId`. `preview: true` drops the active-status filter and skips `survey_starts` insert.

`complete` short-circuits when `preview: true` — computes terminal message + `isPositive` for the renderer but skips all writes so editor previews don't pollute `customers` / `survey_responses` / `survey_starts`.

## Form-builder defaults (regression-tested)

`packages/shared/src/validators/survey-steps.test.ts` has a "fresh step defaults" suite that mirrors `defaultConfigFor(type)` in `journeys/[id]/page.tsx` for all 8 button types. Validator `nextStepId` / `defaultNextStepId` / source-ref fields all accept `null | undefined | string` (the editor uses `null` as its "not wired yet" sentinel). Engine treats falsy as "no next step" via `?? null` + `if (!nextStepId)` everywhere.

## Public engine quirks
- `?preview=true` drops `status='active'` filter and skips persistence
- `template !== 'deep'` is the right check, not `template === 'quick'` (Hotfix-3)
- `submitLegacyJourneySchema.journeyScreenId` is `z.string().min(1).max(128)` not UUID (synthetic ids like `${surveyId}-screen` aren't UUIDs — Hotfix-4)
- Legacy compat shims (`getPublicLegacyJourney`, `submitLegacyJourney`, etc.) still exist for older paths but the canonical public surface is the step engine

## Phase 1 — AI happy-review draft (`0eee598`)

`trpc.survey.generateHappyReviewDraft` composes a short positive review via [[OpenRouter]] (`openai/gpt-4o-mini` default) for the customer's clipboard at Journey A Step 3a.1. Falls back to `"Had a great experience at <name>!"` if `OPENROUTER_API_KEY` is missing or the call fails. Wired into the renderer's `RedirectStep` `submitRedirectYes` — called BEFORE submit + external redirect.

## Phase 2 — workspace redirect-URL fallback (`29393f7`)

`getPublicLegacyJourney` and `getInitialState` merge `workspaces.settings.defaultRedirectLinks` (set during [[Onboarding]]) into `screen.redirectLinks`. Survey-step value wins per platform; workspace defaults fill gaps.

## Connects to
- [[Public-Pages]] — what customers see at `/j` and `/f`
- [[Customer-Journeys]] — every flow that touches this engine
- [[QR]] — QR codes target survey slugs
- [[Branding-Resolution]] — engine resolves branding before serving
- [[Customers]] — `complete()` upserts customers from contact data
- [[Reviews]] — happy-path branches prompt for external reviews (loopback via [[Connectors]])
- [[Escalations]] — unhappy paths can fire CX rules
- [[NEV]], [[CLI]], [[Business-Aspects]] — derived signals from responses
- [[OpenRouter]] — Phase 1 AI review draft
- [[Onboarding]] — Phase 2 redirect URL defaults
- [[Hotfix-Trail]]
