# Phase 3 Execution Plan — Surveys & Journeys Merger

**Generated:** 2026-05-01 (post-Phase-2-backend)
**Source spec:** `PRD_OptimizerV6_Master.md` § Phase 3 (lines 1680–2148)
**Goal:** One unified `surveys` concept that subsumes both `journeys` (Quick template) and `truforms` (Deep template). Same engine runs both. Existing data preserved during a dual-write transition.

---

## 0. Why Phase 3

Today there are two competing products with different schemas, routers, and UIs:
- `journeys` → fast single-screen QR feedback collectors (adaptive metric)
- `truforms` → multi-question surveys (NPS / CSAT / CES / custom)

They share infrastructure (QR generation, response storage shape, NEV/CLI integration) but have separate routers + different builder UIs.

After Phase 3:
- One `surveys` table with a `template: 'quick' | 'deep'` discriminator.
- One engine runs both via a typed `steps[]` array.
- Two modes per survey: `intelligent` (pre-built template, server picks defaults) or `builder` (drag-drop full customization).
- The 8-step library covers everything either old product did, plus more (branch_by_score / branch_by_answer enable arbitrary flows).

---

## 1. Stage breakdown

### Stage A — Schema (pure additive)
Migration adds:
- `survey_template` enum (`quick` | `deep`)
- `survey_mode` enum (`intelligent` | `builder`)
- `survey_status` enum (`draft` | `active` | `archived`)
- `surveys` table
- `survey_responses` table
- `survey_starts` table (closes the TruForms abandonment-tracking gap)

`legacy_journey_id` + `legacy_truform_id` columns on `surveys` track the migration source so we can verify counts and roll back per-row.

### Stage B — Backfill migration
Copy every existing `journeys` row → `surveys` with `template='quick'`, `mode='intelligent'`. Copy `truforms` → `surveys` with `template='deep'`. Migrate `journey_responses` and `truform_responses` → `survey_responses`. Migrate the journey responses' metric data (`metricShown`, `metricScore`) into the new flat columns.

Idempotent: `WHERE NOT EXISTS legacy_id match` prevents double-insert on re-run. Dual-write era starts here — legacy tables stay intact, new writes go to `surveys`.

### Stage C — Step library types + engine
TypeScript types for the 8 step types in `packages/shared/src/types/survey-steps.ts`. `SurveyEngineService` in `apps/api/src/surveys/survey-engine.service.ts` with:
- `getInitialState(slug, sessionId?)`: returns first step + (creates) the `survey_starts` row.
- `advance(surveyId, sessionId, stepId, answer)`: validates, computes next step via step config / branches.
- `complete(surveyId, sessionId, finalState)`: writes `survey_responses`, updates `survey_starts.completedAt`, fires automation events, optionally issues coupon.

Plus the pre-built intelligent step generators for Quick + Deep templates so old behaviour is preserved.

### Stage D — Survey router (public + protected)
- Public: `survey.getInitialState`, `survey.advance`, `survey.complete`.
- Protected CRUD: `survey.list`, `survey.getById`, `survey.create`, `survey.update`, `survey.archive`.

### Stage E — Compatibility shim
Public URL routing:
- `/j/{slug}` → look up in `journeys` first (legacy path), fall back to `surveys` (new).
- `/f/{slug}` → look up in `truforms` first, fall back to `surveys`.
- `/s/{slug}` → only checks `surveys`.

Prevents broken QR codes during transition.

### Stage F — Builder UI (deferred — UX-heavy)
React Flow canvas with step-library sidebar and right-panel config editor. Live phone-frame preview. Deferred to a focused UX session.

---

## 2. What ships this session

Realistic scope: **Stages A → D**.
- Schema (additive, safe)
- Backfill (idempotent)
- Engine + step types (pure logic, testable)
- Public router endpoints

Stages E (compat shim) and F (builder UI) wait for next sessions. Stage F especially needs UX direction — the React Flow canvas is non-trivial and customers' first impression of "the new Surveys product" should not be a half-baked builder.

---

## 3. Key decisions

### `surveys.organizationId` is NOT NULL from day one
Previous tables (journeys, truforms) had no `organization_id` because they pre-date Phase 1. The migration derives it from `workspace.organizationId` (Phase 1 ensures every workspace has one).

### Dual-write era
- All NEW survey creates go to `surveys` only (not `journeys`/`truforms`).
- Legacy slugs (`/j/abc`) still resolve via the compat shim (Stage E).
- Phase 4 makes legacy tables read-only. Phase 5+1mo drops them.

### Step storage: `surveys.steps` JSONB array
Single column, not a separate table. Trade-off:
- Pro: simpler queries, no joins for the engine, atomic save.
- Con: can't query individual steps from SQL. Acceptable — analytics happens on `survey_responses`, not `surveys.steps`.

### `survey_responses` keeps both flat and JSONB shape
- `metricShown` / `metricScore` / `isPositive` / `score` are dedicated columns for cheap analytics queries.
- `responseData` JSONB carries the rest (per-step answers, custom fields, etc.).

### `survey_starts` exists from day one
Closes the TruForms abandonment gap (today, abandoned forms aren't tracked because no row gets inserted). Also lets `journey_abandoned` automation triggers fire correctly across both templates.

### No engine state machine in DB
The engine resolves "next step" purely from the static `steps[]` graph + the customer's current answer. No persistent state per-session beyond the `survey_starts` row + the eventual `survey_responses` row. Lighter than a full state machine; works because step graphs are small (under 30 nodes typically).

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Migration writes wrong steps for some journey configs | Dual-write era preserves legacy data. Roll back is "stop reading from `surveys`, resume from `journeys`/`truforms`". `legacy_*_id` columns let us cross-reference. |
| Public URL changes break QRs in production | Compat shim (Stage E) keeps `/j/{slug}` and `/f/{slug}` working forever. New URLs are `/s/{slug}` only. |
| Legacy responses' `responseData` JSONB shape mismatch | We copy the shape verbatim into `survey_responses.responseData` and ALSO populate the new flat columns. Frontend reads from the flat columns where possible; JSONB is the long tail. |
| Step engine bugs break public submission | Stage C ships with extensive unit tests on the engine's pure-logic parts (next-step resolution, branch evaluation). Integration tests run end-to-end on a sample survey. |

---

## 5. Migration numbering

Phase 0: 0001–0006. Phase 1: 0007–0009. Phase 2: 0010. Phase 3 starts at 0011.

---

OK, executing Stage A now.
