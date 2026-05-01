# Phase 5 — Drop legacy journeys + truforms tables

**Status:** Complete.
**Migration applied:** 0014 (in production)
**Tests:** 74 passing.
**Source spec:** `PHASE_4_PLAN.md` § "Phase 5 (T+1mo)" — pulled forward at user request.

---

## TL;DR

The five legacy tables — `journeys`, `truforms`, `journey_responses`, `truform_responses`, `journey_screens` — are gone. So are their enums (`screen_type`, `truform_type`, `truform_status`), the Phase 4 freeze trigger function, and ~1500 lines of legacy service code. The QR codes in the wild (`/j/{slug}`, `/f/{slug}`) keep working — the renderer reads now come from the survey engine via two new shim endpoints.

```
Before Phase 5                          After Phase 5
┌────────────────────┐                  ┌────────────────────┐
│ journeys           │                  │                    │
│ truforms           │                  │ surveys            │
│ journey_responses  │  ──── DROP ───►  │ survey_responses   │
│ truform_responses  │                  │ survey_starts      │
│ journey_screens    │                  │                    │
└────────────────────┘                  └────────────────────┘
   FKs from nev_responses, cli_responses,
   coupon_instances, automation_queue,
   automation_rules → all dropped.
   The id columns themselves stay as
   orphan UUIDs (no FK) for historical
   analytics; cross-reference via
   surveys.legacy_*_id +
   survey_responses.legacy_*_response_id.
```

---

## Stages shipped

### Stage A — Legacy-shape read endpoints on the survey engine (commit pending)

Two new public queries on the survey router that reconstruct the old `journey.getPublic` / `truform.getPublic` shapes from a survey row + its step graph:

- `survey.getPublicLegacyJourney({slug})` — returns the legacy journey shape (id, slug, name, locationId, settings.reviewPlatform, screen.{metricShown, question, scaleLabels, aspectTags, feedbackPlaceholder, reviewPromptCopy, redirectLinks, reviewTemplate, thankYouHappyYes/No/Unhappy}). Walks the typed step graph: ask_metric → step.config.metric / question / scaleLabels; redirect → reviewTemplate / yesLabel / noLabel / redirectLinks[platform]; ask_question → aspectTags from config.options; end_journey → thankYou messages by stable id + triggerEvent.

- `survey.getPublicLegacyTruform({slug})` — returns `{id, name, type, config: {brandColor, thankYouMessage}}` straight from `surveys.settings` (`type`, `branding.brandColor`, `thankYouMessage`).

Both return the legacy id (`survey.legacy_journey_id` / `legacy_truform_id`) as the `id` field so any caller that still holds a legacy UUID can pass it back to `survey.submitLegacyJourney` / `submitLegacyTruform`.

### Stage B — Renderer read flip (commit pending)

Single-line swap in each renderer page:

- `apps/web/src/app/j/[slug]/page.tsx`: `trpc.journey.getPublic` → `trpc.survey.getPublicLegacyJourney`. UI logic untouched.
- `apps/web/src/app/f/[slug]/page.tsx`: `trpc.truform.getPublic` → `trpc.survey.getPublicLegacyTruform`. UI logic untouched.

The submit calls were already pointed at `survey.submitLegacyJourney` / `submitLegacyTruform` since Phase 3 Stage E — no change needed there.

### Stage C — Migration 0014 (commit pending)

`scripts/migrations/0014_drop_legacy_tables.sql`:

1. Drop external FK constraints from dependent tables (`nev_responses`, `cli_responses`, `coupon_instances`, `automation_queue`, `automation_rules`) — the id columns themselves remain as orphan UUIDs.
2. Drop the Phase 4 BEFORE INSERT/UPDATE triggers + the `raise_legacy_table_frozen()` function.
3. `DROP TABLE` in dependency order: response tables → screens → parents.
4. `DROP TYPE` for `screen_type`, `truform_type`, `truform_status`.

**Production verification (run during this commit):**

```
Legacy tables remaining:  (none ✓)
Legacy enums remaining:   (none ✓)
surveys.count:            15  (10 quick + 5 deep — same as Phase 3 backfill)
survey_responses.count:   375 (= 224 legacy journey responses + 151 legacy truform responses)
```

### Stage D — Code deletion + import cleanup (commit pending)

**Deleted entire directories:**
- `apps/api/src/journey/` — service, router, module, tests
- `apps/api/src/truform/` — service, router, module, tests

**Deleted schema files:**
- `packages/db/src/schema/journeys.ts`
- `packages/db/src/schema/truforms.ts`
- `packages/db/src/schema/journey-screens.ts` *(was already absent)*

**Deleted validator files:**
- `packages/shared/src/validators/journey.ts`
- `packages/shared/src/validators/truform.ts`

**Updated import lists:**
- `packages/db/src/schema/index.ts` — removed `journeys` / `truforms` exports
- `packages/shared/src/index.ts` — removed `journey` / `truform` validator re-exports
- `apps/api/src/trpc/trpc.module.ts` — removed `JourneyModule` + `TruformModule`
- `apps/api/src/trpc/trpc.router.ts` — removed `createJourneyRouter` / `createTruformRouter` imports + their static and runtime registrations + the constructor-injected services

**Patched dependent schema files** to drop the now-broken FK declarations and keep the columns as orphan UUIDs:
- `packages/db/src/schema/nev.ts` — `truformResponseId`, `journeyResponseId`
- `packages/db/src/schema/cli.ts` — same
- `packages/db/src/schema/coupons.ts` — `journeyResponseId`
- `packages/db/src/schema/automations.ts` — `journeyId`, `journeyResponseId`
- `packages/db/src/schema/relations.ts` — removed `journeysRelations`, `truformsRelations`, `journeyScreensRelations`, `journeyResponsesRelations`, `truformResponsesRelations`, and the cross-table relations from `couponInstances` / `automationQueue` / `nevResponses` / `cliResponses` to the dropped response tables.

**Patched callers** that still queried the legacy tables:
- `apps/api/src/automation/automation.service.ts` — `journeyResponses.findFirst` → `surveyResponses.findFirst` (with fallback through `legacy_journey_response_id` for in-flight queue entries from the cutover window).
- `apps/api/src/qr/qr.service.ts` — `lookupJourneySlug` / `lookupFormSlug` now query `surveys` filtered by `template` and accept either the new `surveys.id` or the legacy `legacy_journey_id` / `legacy_truform_id`.
- `apps/api/src/report/report.service.ts` — `generateTruformsReport` reads from `surveys WHERE template='deep'` + `survey_responses`; `generateJourneyAnalytics` reads from `surveys WHERE template='quick'` + `survey_responses`. The per-screen abandonment block (`dropOffByScreen`, `screenCount`) returns empty / zero — porting to per-step abandonment (against `survey_starts`) is deferred.

**Touched but not rewritten:**
- `packages/db/seed-demo.mjs` — legacy-table seeding sections wrapped in `if (false) {…}` with a TODO comment to port to surveys. This script is dev-only (not in CI).

---

## Caveats

### Orphan UUIDs

`coupon_instances.journey_response_id`, `automation_queue.journey_response_id`, `automation_rules.journey_id`, `nev_responses.{truform_response_id, journey_response_id}`, and `cli_responses.{truform_response_id, journey_response_id}` no longer have referential integrity. They hold UUIDs that point at rows that don't exist. A future cleanup migration can either:
- Migrate them to point at `survey_responses.id` / `surveys.id` via the `legacy_*_id` cross-reference, then rename the columns; or
- Drop the columns entirely.

This is an analytics decision — not a Phase 5 blocker.

### Reports lost per-screen depth

`generateJourneyAnalytics` no longer reports `dropOffByScreen` or `screenCount`. The new step-graph shape (`surveys.steps`) needs a different report — per-step abandonment via `survey_starts`. Punted to Phase 6.

### Demo seed broken

`packages/db/seed-demo.mjs` skips journey + truform seeding. Re-implementing against `surveys` is straightforward (use the `buildQuickIntelligentSteps` / `buildDeepIntelligentSteps` builders from `@rectangled/shared`) but didn't make the cut for this commit.

---

## Verification

```
npx turbo build           → 4/4 packages green
npm test                  → 74/74 passing
node dist/main.js         → boots; SurveysModule initialized; Nest started
node scripts/migrate.mjs  → 14/14 applied in prod
```

Live counts post-migration:
```
surveys.template='quick' :  10
surveys.template='deep'  :   5
survey_responses         : 375
journeys / truforms / *_responses / journey_screens : (table dropped)
```

---

## Commit log

```
<pending>  feat(phase-5): drop legacy journeys + truforms tables
8bece63   feat(surveys): Stage E — legacy compat shim for /j/ + /f/ URLs
1e0485f   feat(phase-4): freeze legacy journeys + truforms (read-only)
```
