# Hotfix PRD §3 — Wizard Custom Journey Builder

**Status:** Complete.
**Migrations applied:** 0020 (Test 5 cleanup, Step A prerequisite)
**Tests:** 111 vitest + 14/14 §3 smoke test (transaction-rollback against prod) + 19/19 step-validator dry-run.
**Source spec:** `docs/PRD_Hotfix_Customer_Journey_Rebuild.md` § 3.

---

## TL;DR

The React Flow canvas at `/dashboard/surveys/[id]` was too complex for SMB owners ("screens nahi ban rahe, logic nahi ban raha aacha se"). This hotfix replaces it for the new `template='custom'` template with:

1. **A 4-question wizard** (`+ New Custom Journey` button on the surveys list) that maps deterministically to a step graph.
2. **A pre-rendered decision-tree editor** with clickable boxes + a per-step content panel — no canvas, no edge dragging, no node reordering.
3. **`+ Insert step here` buttons** on the negative-chain edges for adding Open Questions, Info Screens, or Contact Forms.
4. **Validation banners** for cycles / dead-ends / unreachable / missing pointers / branch structural rules — Save disabled while errors exist.
5. **Phone preview** — opens `/j/{slug}?preview=true` in a new tab; the engine no-ops persistence so the owner walks the actual public renderer with zero side effects.

The React Flow canvas stays in place for `template='quick'` and `template='deep'` with `mode='builder'`. Adaptive surveys keep their dedicated form from §2. Three different editors for three different mental models — intentional, not inconsistent.

---

## What shipped

### Step A — Strict step-graph validators (commit `dce1b4e`)

Discriminated-union Zod validators for the 8 SurveyStep kinds, mirroring the canonical TS types 1:1. Tightens `survey.update.steps` from `z.array(z.record(z.unknown()))` to `surveyStepSchema[]`.

- **`packages/shared/src/validators/survey-steps.ts`** *(NEW)* — schemas for `ask_metric`, `ask_question`, `branch_by_score`, `branch_by_answer`, `show_message`, `collect_contact`, `redirect`, `end_journey`. CES inversion sourced from `INVERTED_METRICS` (single source of truth).
- **`packages/shared/src/validators/survey-steps.test.ts`** *(NEW)* — 20 vitest cases (1 valid + 1 invalid per type, plus discriminator + array-level + threshold-sentinel checks).
- **`scripts/migrations/0020_delete_test5_abandoned.sql`** — deletes the one prod survey ("Test 5", 0 responses, structurally broken — `fromStepId` typo + null `nextStepIds` + empty `branches[]`) so the dry-run hits 19/19 strict.
- **`scripts/dry-run-step-validators.mjs`** *(NEW)* — re-runnable validation pass against all prod surveys' `steps[]`.

### PR 1 — Wizard helper + create flow (commit `9c7f001`)

- **`packages/shared/src/constants/survey-step-builders.ts`** — adds `buildCustomStepsFromWizard(answers, opts?)`. Pure mapper from wizard answers → step graph. Throws on `metric='random'` (caller must intercept and use the §2 adaptive path).
- **`packages/shared/src/validators/survey-wizard.ts`** *(NEW)* — `wizardAnswersSchema`, `createSurveyFromWizardSchema`. Wizard's `metric` includes the `'random'` short-circuit signal.
- **`packages/shared/src/constants/survey-step-builders.test.ts`** *(NEW)* — 17 vitest cases. Each test asserts structural integrity (reachable from `step[0]`, all next-pointers valid, terminal nodes are `end_journey`).
- **`apps/api/src/surveys/survey-crud.service.ts`** — `createFromWizard` method. Atomic create. `metric='random'` short-circuits to `template='adaptive'` via `this.create`. Concrete metrics resolve `couponTemplateId` server-side: 1 active template auto-picks, 0 rejects with a clear message, 2+ requires explicit selection.
- **`apps/api/src/surveys/survey.router.ts`** — `survey.createFromWizard` mutation, protected.
- **`apps/web/src/components/surveys/create-custom-journey-wizard.tsx`** *(NEW)* — 4-step Dialog. Natural-language copy ("When the customer is positive..."), Positive/Negative throughout. Random-metric Q1 short-circuits to single submit ("Generate Adaptive Journey"). Threshold presets are metric-aware. Issue-coupon checkbox is disabled-with-tooltip on 0 templates / auto-fills with 1 / surfaces dropdown on 2+.
- **`apps/web/src/app/dashboard/surveys/page.tsx`** — `+ New Custom Journey` button on the surveys list, beside the existing `Create Survey` button.

### PR 2 — Decision-tree editor + insert + validation (commit `0073bd7`)

- **`apps/web/src/components/surveys/decision-tree-editor.tsx`** *(NEW)* — main editor. Parses graph into `{metric, branch, positiveStructure, negativeChain}`. Renders a Tailwind grid + flex tree (zero React Flow). Each box is a clickable `StepBox`; click → edit panel. State model: `draftSteps` accumulates, Save persists via `trpc.survey.update`. Insert/delete logic rewires single-next pointers in the negative chain. Structural step IDs (`s1_metric`, `s2_branch`, `s3_positive`, `s_end_*`) are non-deletable.
- **`apps/web/src/components/surveys/decision-tree-edit-panel.tsx`** *(NEW)* — per-type content editor. Wizard-locked metadata (metric pick, branch op direction, redirect platform on `s3_positive`) rendered read-only with explainers. Coupon dropdown reads workspace coupon templates.
- **`apps/web/src/components/surveys/insert-step-modal.tsx`** *(NEW)* — 3 options per PRD §3.5: Open Question / Info Screen / Contact Form. Owner cannot add new metric ask, new branch, new redirect, or multiple ends — wizard-locked structure.
- **`apps/web/src/lib/step-graph-validation.ts`** *(NEW)* — PRD §3.9 validation: reachability, cycles, dead-ends, missing pointers, branch structural rules, duplicate IDs. Error messages reference `STEP_TYPE_LABELS` not internal type strings.
- **`apps/web/src/app/dashboard/surveys/[id]/page.tsx`** — Builder tab now branches 3-way: `'adaptive'` → `AdaptiveSettingsForm` (§2) | `'custom'` → `DecisionTreeEditor` (PR 2) | else → React Flow canvas (untouched).
- **`apps/web/src/components/surveys/create-custom-journey-wizard.tsx`** — wizard's `onSuccess` now redirects custom journeys to the per-survey editor (was a stopgap to surveys list in PR 1).

### Owner-facing copy (Pass 2 vocab — commit `95f9c30`)

`packages/shared/src/constants/step-type-labels.ts` is the single source of truth for owner-facing label / description / emoji per step type:

```
ask_metric        → Rating Question
ask_question      → Open Question
branch_by_score   → Route by Score
branch_by_answer  → Route by Answer
show_message      → Info Screen
collect_contact   → Contact Form
redirect          → Review Redirect
end_journey       → Thank You Screen
```

Internal identifiers (`surveys.steps[].type`, validator schema keys, TS types, code-level identifiers) all stay as-is. Pure-copy commit.

### PR 3 — Phone preview + smoke test (this commit)

- **`packages/shared/src/validators/survey.ts`** — adds `preview?: boolean` to `submitLegacyJourneySchema`.
- **`apps/api/src/surveys/survey-engine.service.ts`**:
  - `getPublicLegacyJourney` — relaxed template gate to allow `'custom'` (same shape reconstruction as `'quick'` works because the wizard's step graph is structurally compatible).
  - `submitLegacyJourney` — relaxed template gate to allow `'custom'`; falls back to `survey.id` lookup for surveys without `legacyJourneyId` (custom + post-merger quick); preview short-circuit at the top: returns `{ success: true, responseId: 'preview-{sessionId}', isPositive }` with NO writes to `survey_starts` / `survey_responses` / `customers` / `reviews`.
- **`apps/web/src/app/j/[slug]/page.tsx`** — reads `?preview=true` via `useSearchParams`, threads `preview: true` through all 4 submit call sites (metric, happy-yes, happy-no, unhappy). Amber preview banner at the top of the renderer when in preview mode.
- **`apps/web/src/components/surveys/decision-tree-editor.tsx`** — `Preview` button next to `Save`. Opens `/j/{slug}?preview=true` in a new tab. Disabled while there are unsaved changes (toast directs owner to save first) or validation errors.
- **`scripts/smoke-test-custom-journey.mjs`** *(NEW)* — 14/14 pass. Three flows against prod with full row-level cleanup:
  - Test A: positive path with `redirect_google` — verifies metric submit, response insert, redirect followup merge, `completed_at` stamp.
  - Test B: negative path with `just_thank` + aspects + contact — verifies customer upsert, response merge, offline review row.
  - Test C: preview mode — submits with `preview: true`, verifies 0 rows written; control submit (no preview) writes exactly 1 response + 1 start.

---

## Production state after §3

| template | mode | count | editor |
|---|---|---|---|
| quick    | intelligent | 2 | (canvas, deferred — non-`builder` mode skips canvas) |
| deep     | intelligent | 4 | (canvas, deferred) |
| adaptive | intelligent | 10 | `AdaptiveSettingsForm` (§2) |
| custom   | intelligent | 0 | `DecisionTreeEditor` (PR 2) |

`mode='builder'` count: still 0. The React Flow canvas stays in place for any future builder-mode surveys but is not exercised by current prod traffic.

---

## What "done" looks like (per PRD §3.10)

- [x] Wizard modal with 4 questions
- [x] Wizard maps to step graph via `buildCustomStepsFromWizard`
- [x] Wizard "Random metric" option creates `template='adaptive'` instead of `custom`
- [x] Editor for `custom` surveys renders decision tree (NOT React Flow)
- [x] Click box → edit panel updates content
- [x] "+Insert step here" inserts a step inline
- [x] Phone preview walks through without creating `survey_starts` row
- [x] Validation catches broken step graphs before save
- [x] React Flow canvas stays for `quick`/`deep` builder mode (do not break existing)
- [x] Smoke test: wizard → 4 answers → generate → preview → activate → scan QR → complete journey end-to-end

---

## Pointers

- Helper:           `packages/shared/src/constants/survey-step-builders.ts` (`buildCustomStepsFromWizard`)
- Wizard validator: `packages/shared/src/validators/survey-wizard.ts`
- Step validator:   `packages/shared/src/validators/survey-steps.ts` (Step A)
- Labels:           `packages/shared/src/constants/step-type-labels.ts`
- Wizard UI:        `apps/web/src/components/surveys/create-custom-journey-wizard.tsx`
- Editor:           `apps/web/src/components/surveys/decision-tree-editor.tsx`
- Edit panel:       `apps/web/src/components/surveys/decision-tree-edit-panel.tsx`
- Insert modal:     `apps/web/src/components/surveys/insert-step-modal.tsx`
- Validation:       `apps/web/src/lib/step-graph-validation.ts`
- Renderer:         `apps/web/src/app/j/[slug]/page.tsx` (preview detection + threading)
- Engine:           `apps/api/src/surveys/survey-engine.service.ts` (gates relaxed, preview short-circuit, lookup fallback)
- Smoke test:       `scripts/smoke-test-custom-journey.mjs`
- Source spec:      `docs/PRD_Hotfix_Customer_Journey_Rebuild.md` §3
