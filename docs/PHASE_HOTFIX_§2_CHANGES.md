# Hotfix PRD §2 — Adaptive Customer Journey restore

**Status:** Complete.
**Migrations applied:** 0018, 0019 (in production)
**Tests:** 74 vitest + 17/17 adaptive engine smoke test (transaction-rollback against prod).
**Source spec:** `PRD_Hotfix_Customer_Journey_Rebuild.md` § 2 + `PRD_Adaptive_Customer_Journey_v2.md` (full v2 PRD).

---

## TL;DR

12 surveys with `template='quick'` + `mode='intelligent'` were the v1 Adaptive Customer Journey rows that survived the Phase 3 merger as step-graph implementations of the v2 flow. The merger preserved their behaviour but moved the editor UX into the React Flow canvas — confusing for SMB owners.

This hotfix:
1. Adds `'adaptive'` and `'custom'` enum values to `survey_template`.
2. Builds a dedicated `AdaptiveEngineService` that runs the locked v2 flow directly from `survey.settings`, bypassing the step graph.
3. Migrates 10 of the 12 quick+intelligent surveys to `template='adaptive'` (the 2 post-merger ones with `legacy_journey_id IS NULL` stay on the step engine — they were created via `survey.create` after the merger).
4. Replaces the React Flow canvas with a simple form for adaptive surveys.
5. Surfaces an owner banner on adaptive surveys with empty redirect URLs.

The customer-facing flow is unchanged: scan → metric question → threshold-based happy/unhappy split → review prompt or aspect feedback. Same input, same output, different implementation under the hood.

---

## What shipped

### Backend

- **`scripts/migrations/0018_add_adaptive_custom_enum.sql`** — `ALTER TYPE survey_template ADD VALUE IF NOT EXISTS 'adaptive' / 'custom'`. Idempotent, non-blocking.

- **`scripts/migrations/0019_migrate_quick_intelligent_to_adaptive.sql`** — flips 10 rows + cleans the corrupted "Reviews" survey settings (70 numeric junk keys stripped).

- **`packages/db/src/schema/surveys.ts`** — `surveyTemplateEnum` widened.

- **`packages/shared/src/validators/survey.ts`** — `surveyTemplateSchema` widened to all 4 values.

- **`apps/api/src/surveys/adaptive-engine.service.ts`** *(NEW)* — implements v2 §3 verbatim:
  - `getInitialState({slug, sessionId?})` — picks one metric uniformly at random from `settings.enabledMetrics` (or 404 if empty), inserts idempotent `survey_starts`, returns the metric question + redirect URL + thank-you copy. **Crucially, the response payload contains NO `threshold` field** — score validation happens server-side at `submitMetric` time. Smoke-tested.
  - `submitMetric` — first-phase submit. Validates score range per metric, computes `is_positive` via `METRIC_DEFAULT_THRESHOLDS` + `INVERTED_METRICS` (CES is `<=`, others `>=`), inserts `survey_responses` with hot-path columns populated.
  - `submitFollowup` — second-phase submit. Merges contact/aspect/yes-no into the existing response, upserts customer (workspace-scoped phone-then-email lookup, mirrors the truform-shim pattern), creates an offline review on unhappy completion, stamps `survey_starts.completed_at`.

- **`apps/api/src/surveys/survey-engine.service.ts`** — when a survey has `template='adaptive'`, both `submitLegacyJourney` and `getPublicLegacyJourney` delegate to `AdaptiveEngineService`. The legacy renderer at `/j/{slug}` keeps calling the same shim entry points; the input/output shape is identical so nothing on the frontend had to change.

- **`apps/api/src/surveys/surveys.module.ts`** — `AdaptiveEngineService` registered as a Nest provider.

### Frontend

- **`apps/web/src/components/surveys/adaptive-settings-form.tsx`** *(NEW)* — flat editor form for adaptive surveys. Fields:
  - Enabled metrics + per-metric thresholds (checkboxes + numeric inputs)
  - Review platform + URL
  - Aspect tags (comma-separated)
  - Review template (clipboard-copy on Yes)
  - Three thank-you copy fields
  - **Owner banner** (yellow `Alert`) when the active platform's redirect URL is empty.

- **`apps/web/src/app/dashboard/surveys/[id]/page.tsx`** — Builder tab branches:
  - `template === 'adaptive'` → renders the adaptive form.
  - everything else (`quick`/`deep`/`custom`) → keeps the React Flow canvas + step graph editor.

### Smoke tests

- **`scripts/smoke-test-adaptive-engine.mjs`** — bootstraps `AdaptiveEngineService` directly (no Nest HTTP context — that triggers TrpcRouter's onModuleInit which needs an HTTP adapter), runs three flows against prod, deletes test data + restores template at the end.

  - **Test A — Threshold non-leak.** Sets `settings.thresholds.csat` to `4242424242` (sentinel), calls `getInitialState`, asserts `JSON.stringify(payload)` contains neither the substring `threshold` nor the sentinel value. Per v2 PRD §6.2, the threshold must never reach the client.
  - **Test B — Happy path.** `submitMetric(csat=5)` → `isPositive=true`, customer null. Then `submitFollowup({acceptedReviewPrompt: true, redirectedTo: 'google'})` → response_data merged, no customer (no contact info), `completed_at` stamped.
  - **Test C — Unhappy path with contact.** `submitMetric(csat=2)` → `isPositive=false`. Then `submitFollowup({aspectTags, name, email, phone})` → customer row created, `customer_id` linked on the response, offline review row in `reviews` (rating=2, source='offline').
  - **Test D — survey_starts funnel.** Both sessions produce `survey_starts` rows with `completed_at` stamped after the followup.

  Latest run: **17/17 pass**.

---

## Production state after migration

```
adaptive : 10  (the 10 backfilled v1 journeys — all run via AdaptiveEngineService)
quick    :  2  (test 6, test 3 — created post-merger via survey.create, no legacy_journey_id; stay on step engine)
deep     :  8  (truform-backed surveys — unchanged)
custom   :  0  (reserved for §3 wizard; no rows yet)
```

**Reviews survey settings:** 70 numeric junk keys removed; named keys (`thresholds`, `enableCoupon`, `enabledMetrics`, `reviewPlatform`, `positiveThreshold`) intact.

---

## Owner-review list

The 3 Spice Garden surveys with empty `redirectLinks.google` (pre-existing data gap, not caused by migration):

| Survey | Slug | Historical responses |
|--------|------|----------------------|
| Dine-In Feedback Journey | `dine-in-feedback-8152` | 67 |
| Delivery Feedback Journey | `delivery-feedback-3937` | 67 |
| Quick NPS Survey | `quick-nps-3629` | 66 |

Customers who've scanned these QRs and given a positive score get the "Yes/No" review prompt, but tapping Yes opens nothing because no URL is configured. Owner now sees a yellow banner in the editor on each of these surveys with a "Set redirect URL" call to action.

The "Test 1" survey (Pranav's test) and the "Reviews" survey (also Pranav's) DO have valid GBP review URLs and will redirect correctly.

---

## What "done" looks like (per v2 PRD §15 + Hotfix §2.8)

- [x] `'adaptive'` and `'custom'` enum values added
- [x] Migration migrates broken quick-intelligent surveys → adaptive (10 of 12; 2 stay quick by design)
- [x] `adaptive-engine.service.ts` exists and implements v2 spec
- [x] Engine routing in public handler routes by template (in `submitLegacyJourney` + `getPublicLegacyJourney`)
- [x] Builder UI renders adaptive settings form (no React Flow)
- [x] Public URL `/j/{slug}` for adaptive survey loads first metric correctly (via `getPublicLegacyJourney` → `AdaptiveEngineService.getInitialState`)
- [x] Smoke test: csat 5 → happy path → review prompt → redirect (test B)
- [x] Smoke test: csat 2 → unhappy path → aspect tags → contact → offline review (test C)
- [x] Threshold non-leak verified (test A)
- [x] survey_starts funnel verified (test D)
- [x] All build + tsc + tests green

---

## Pointers

- Engine: `apps/api/src/surveys/adaptive-engine.service.ts`
- Routing bridge: `apps/api/src/surveys/survey-engine.service.ts` (`delegateToAdaptive`, `legacyShapeFromAdaptive`)
- UI form: `apps/web/src/components/surveys/adaptive-settings-form.tsx`
- Smoke test: `scripts/smoke-test-adaptive-engine.mjs`
- Rollback: `docs/HOTFIX_§2_ROLLBACK.md`
- Source spec: `PRD_Hotfix_Customer_Journey_Rebuild.md` §2 + `PRD_Adaptive_Customer_Journey_v2.md`
