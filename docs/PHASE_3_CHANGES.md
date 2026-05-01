# Phase 3 — Surveys & Journeys merger (backend)

**Status:** Backend complete (Stages A → D). Frontend stages (E compat shim, F builder UI) deferred for UX review.
**Migrations applied:** 0011, 0012 (in production)
**Backfill:** 10 quick + 5 deep surveys; 375 survey_responses (verified idempotent).
**Tests:** 70 passing (added 17 for survey-branch-eval).
**Source spec:** `PRD_OptimizerV6_Master.md` § Phase 3, `PHASE_3_PLAN.md`

---

## TL;DR

Two legacy concepts — `journeys` (Quick template) and `truforms` (Deep template) — are now a single `surveys` concept with a typed step graph and a unified engine. Existing rows keep working: every journey/truform was backfilled into `surveys` with its `legacy_*_id` preserved, and the renderer for `/j/{slug}` + `/f/{slug}` will route through the new engine in Stage E (deferred).

```
┌────────────────────────┐         ┌────────────────────────┐
│ journeys     (10 rows) │ ──┐  ┌─→│ surveys.template=quick │
└────────────────────────┘   │  │  └────────────────────────┘
                             ├──┤
┌────────────────────────┐   │  │  ┌────────────────────────┐
│ truforms     ( 5 rows) │ ──┘  └─→│ surveys.template=deep  │
└────────────────────────┘            └─────────────────────┘
```

---

## Stages shipped

### Stage A — Unified schema (commit `37fee7f`)

Migration `0011_surveys_schema.sql`. Pure additive — legacy tables untouched.

- 3 enums: `survey_template` (quick|deep), `survey_mode` (intelligent|builder), `survey_status` (draft|active|archived).
- 3 tables: `surveys`, `survey_responses`, `survey_starts`.
- Hot-path columns on `survey_responses`: `metric_shown`, `metric_score`, `is_positive`, `score`, `answers` — keeps analytics queries cheap (no JSONB extracts on the hot path).
- Legacy tracking columns: `legacy_journey_id`, `legacy_truform_id`, `legacy_journey_response_id`, `legacy_truform_response_id`.
- `survey_starts` has `UNIQUE(survey_id, session_id)` so the engine's "first visit" insert is idempotent. Partial index on abandonment (`WHERE completed_at IS NULL`) makes "how many opened-but-never-finished today" cheap.

`packages/db/src/schema/surveys.ts` — Drizzle declarations mirror the SQL.

### Stage C — Step library + engine (commit `529fa61`)

> Stage C ran before B because the backfill (Stage B) needs the step-graph builders.

**`packages/shared/src/types/survey-steps.ts`** — typed step union, 8 step kinds:

```ts
type SurveyStep =
  | AskMetricStep          // metric: 'csat'|'nps'|'ces'|'nev'|'cli'|'random'
  | AskQuestionStep        // textarea, single_select, multi_select, rating, ...
  | BranchByScoreStep      // gte/lte/gt/lt/eq/in; supports 'threshold' sentinel
  | BranchByAnswerStep     // eq/in/contains
  | ShowMessageStep        // info screen; one nextStepId
  | CollectContactStep     // name/email/phone
  | RedirectStep           // google|zomato|swiggy + Yes/No prompt
  | EndJourneyStep         // terminal; carries triggerEvent + optional coupon
```

Eight type guards (`isAskMetric`, `isBranchByScore`, ...) for the engine's discrimination.

**`packages/shared/src/constants/survey-step-builders.ts`** — pure functions that produce the 'intelligent' step graph for each (template, type) combo:
- `buildQuickIntelligentSteps(opts?)` — 8 steps mirroring Journey v2 (random metric → branch by threshold → happy path with redirect / unhappy path with aspect-tag question + contact).
- `buildDeepIntelligentSteps(type, opts?)`:
  - `nps` — 6 steps with detractor / passive / promoter branching.
  - `csat` — 4 steps simple flow.
  - `ces` — 6 steps with hard / easy branching (CES inverted: high score = hard).
  - `custom` — single end_journey step (placeholder for builder mode).

**`packages/shared/src/constants/survey-branch-eval.ts`** + 17 unit tests — pure helpers:
- `evaluateScoreCondition(op, value, score)` and `pickNextStepIdByScore` — handle the `'threshold'` sentinel by deferring to a `resolveThreshold(metric)` callback so the same builder works across surveys with different per-metric thresholds.
- `evaluateAnswerCondition(op, value, answer)` and `pickNextStepIdByAnswer`.

**`apps/api/src/surveys/survey-engine.service.ts`** — three public methods:
- `getInitialState({slug, sessionId?})` — finds active survey by slug, resolves random metric (picks once and freezes for the session), inserts idempotent `survey_starts` row, returns first step + sessionId + interpolated `businessName`.
- `advance({surveyId, sessionId, fromStepId, answer, metricShown?, metricScore?})` — validates the answer against the step kind (score range, required questions), uses `resolveNextStepId` (a pure helper covering all 8 step kinds) to pick the next step, returns it or `{done: true}` for terminals.
- `complete({surveyId, sessionId, finalState, terminalStepId?})` — upserts customer if contact info present, computes `isPositive` from `metricShown + score + threshold`, mirrors per-metric scores into both the JSONB `response_data` and the hot-path columns, marks the start row complete, returns the terminal's `triggerEvent` + optional `issueCouponTemplateId`.

### Stage B — Backfill (commit `ec9445d`)

Migration `0012_surveys_backfill_marker.sql` (records that backfill ran; the SQL itself is a no-op `SELECT 1`).

`scripts/backfill-surveys.mjs` (Node) does the actual work. Why JS not PL/pgSQL: the step-graph builders are TS code, easier to drive from JS than re-implement in pgSQL. Inlines the relevant subset of `@rectangled/shared` so the script runs as plain Node from the repo root.

Idempotent — every insert checks for an existing row by `legacy_*_id`; re-running produces zero rows.

Carries forward redirect URLs, aspect tags, thank-you messages, and enabled metrics from the existing `journey_screens` config so each generated step graph reflects the user's prior customisations.

**Production results (verified):**
```
journeys:           10 processed → 10 surveys (template=quick)
truforms:            5 processed →  5 surveys (template=deep)
journey_responses: 224 processed → 224 survey_responses
truform_responses: 151 processed → 151 survey_responses
─────────────────────────────────────────
total                                375 survey_responses (= 224 + 151) ✓
second run:                            0 new rows (idempotency confirmed) ✓
```

### Stage D — Survey router (commit `b7adf97`)

Two surfaces in one router:

**Public engine** (no auth, drives the renderer):
- `survey.getInitialState(slug, sessionId?)` — first step + sessionId.
- `survey.advance(...)` — validates answer, returns next step.
- `survey.complete(...)` — terminal write + triggers.

**Protected CRUD** (workspace member):
- `survey.list({workspaceId, locationId?, template?, status?, includeArchived?})` — filters mirror the existing journey/truform lists.
- `survey.getById({id})`.
- `survey.create({workspaceId, name, template, mode?, settings?})` — server resolves `organizationId` from the workspace, picks slug prefix (`j-` for quick, `f-` for deep), seeds the step graph from the appropriate `buildXxxIntelligentSteps`. For deep surveys, `settings.type` defaults to `'csat'` if not provided.
- `survey.update({id, name?, locationId?, status?, mode?, settings?, steps?})` — shallow-merges settings; `archived_at` is stamped when status flips to 'archived' and cleared when it flips back.
- `survey.archive({id})` — idempotent; no-op if already archived.

**Files added:**
- `packages/shared/src/validators/survey.ts` — Zod schemas for both surfaces.
- `apps/api/src/surveys/survey-crud.service.ts` — workspace-scoped CRUD with `requireMembership` guard.
- `apps/api/src/surveys/survey.router.ts` — tRPC procedures.
- `apps/api/src/surveys/surveys.module.ts` — Nest module wiring both services.

**Files updated:**
- `apps/api/src/surveys/survey-engine.service.ts` — `answer` is optional in `advance()` to match `z.unknown()`'s inferred type. The engine already handled empty answers (rejects for required questions, accepts otherwise).
- `apps/api/src/trpc/trpc.module.ts` + `trpc.router.ts` — register `SurveysModule` + inject `SurveyCrudService` + `SurveyEngineService` into `TrpcRouter`.
- `packages/shared/src/index.ts` — re-export survey validators.

---

## What's deliberately deferred

### Stage E — Compatibility shim (NOT shipped)

The legacy URLs `/j/{slug}` and `/f/{slug}` should route through the new engine instead of the old journey/truform handlers. Deferred because:
- The new engine is API-only today; the renderer changes (or a thin compat layer in the existing renderer) need a UI review.
- No existing customer URL breaks: the legacy tables still exist, and the legacy handlers still work. We're additive.

When E lands, the legacy `journey.submitResponse` / `truform.submit` mutations will dual-write into `survey_responses` so analytics see the same shape regardless of which entry point a visitor used.

### Stage F — Builder UI (NOT shipped)

Owner-facing React Flow canvas to drag-edit the step graph (mode='builder'). Deferred — pure UI work that doesn't unblock anything backend-side.

The schema and engine already support `mode='builder'` end-to-end: `survey.update({steps})` accepts a full step graph; the engine walks whatever graph is stored. Stage F is "draw the canvas" not "make builder mode work."

---

## Verification

- `npx tsc --noEmit` (apps/api) — clean.
- `npx turbo build --filter=@rectangled/api` — builds. (Web prerender error on `/accept-invite` is pre-existing from Phase 1 Stage G — unrelated to Phase 3.)
- `npm run test` — 70/70 tests pass (added 17 for survey-branch-eval).
- `node dist/main.js` — boots; `SurveysModule dependencies initialized`; `Nest application successfully started`.
- `npm run db:migrate:status` — all 12 migrations applied in prod.
- `npm run backfill:surveys` (second run) — 0 new rows, counts match.

---

## Commit log

```
b7adf97  feat(surveys): Stage D — survey router (public engine + protected CRUD)
ec9445d  feat(surveys): Stage B — backfill journeys + truforms into surveys
529fa61  feat(surveys): Stage C — step library + survey engine
37fee7f  feat(surveys): Stage A — unified surveys schema
8b1a60e  docs(phase-3): execution plan — surveys & journeys merger
```
