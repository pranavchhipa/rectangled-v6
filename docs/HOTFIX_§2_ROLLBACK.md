# Hotfix §2 Rollback Recipe

If the AdaptiveEngineService misbehaves in production after migration 0019, this document tells you exactly what to do. Copy-paste ready.

---

## When to roll back

Roll back if **any** of these is observed:

| Symptom | Where to spot it |
|---------|------------------|
| Customer reports happy-path redirect goes to wrong URL or 404s | Inbox / direct user reports |
| Customer reports unhappy path skips the contact-collection step | Same |
| Server logs show a spike in `[AdaptiveEngineService] ERROR` lines | Application logs |
| Funnel analytics show a sudden drop in `survey_responses.completed_at` rate on adaptive surveys | `/dashboard/responses` workspace view, filter to surveys with `template='adaptive'` |
| Smoke test `node scripts/smoke-test-adaptive-engine.mjs` fails post-deploy | Run it after any deploy that touches engine code |

Single-customer reports of "I tapped Yes but nothing opened" are NOT a rollback signal — that's the empty-redirect-URL gap (§ Owner-review list in `PHASE_HOTFIX_§2_CHANGES.md`); the owner banner inside the editor is the fix path for that.

---

## Step 1 — Flip the 10 migrated surveys back

Copy-paste this against prod (replace `$DATABASE_URL` with your actual env var, or `set -a && source .env && set +a` first):

```bash
psql "$DATABASE_URL" <<'SQL'
UPDATE surveys
SET template = 'quick'
WHERE template = 'adaptive'
  AND mode = 'intelligent'
  AND legacy_journey_id IS NOT NULL;
-- Expect: UPDATE 10
SQL
```

**Why this filter:** matches exactly the rows migration 0019 flipped. Any future surveys someone creates with `template='adaptive'` after the migration won't have `legacy_journey_id` set, so they're untouched by this rollback (you don't accidentally flip a fresh adaptive survey back to quick).

After the UPDATE the 10 surveys route back through the step-graph engine. The step graph was preserved in `surveys.steps` precisely for this — see migration 0019's comment block.

---

## Step 2 — Verify the rollback

### 2a. Counts

```bash
psql "$DATABASE_URL" <<'SQL'
SELECT template, COUNT(*) AS count FROM surveys
WHERE legacy_journey_id IS NOT NULL AND mode = 'intelligent'
GROUP BY template;
-- Expect:
--   quick    | 10
--   adaptive | 0
SQL
```

### 2b. Smoke test that the step engine handles them

```bash
set -a && source .env && set +a
node scripts/smoke-test-journey-shim.mjs
# Expect: 15/15 pass — proves the legacy compat shim is back in charge
# of the migrated surveys via the step engine path.
```

If the smoke test passes, the rollback worked. The `/j/{slug}` URLs for those 10 surveys are now served by the step engine again.

---

## Step 3 — Triage the original failure

Don't redeploy adaptive engine code without a fix for whatever caused the rollback. Common diagnostics:

```bash
# Check application logs for the trigger error
# (DigitalOcean App Platform: Activity → click failed deploy → Build/Runtime logs)

# Inspect the failing survey's settings + steps
psql "$DATABASE_URL" <<'SQL'
SELECT id, name, slug, template, settings, jsonb_array_length(steps) AS step_count
FROM surveys WHERE slug = 'dine-in-feedback-8152';
-- Substitute the slug the customer reported.
SQL
```

If `settings.enabledMetrics` is unexpectedly empty or `settings.thresholds` is missing, the migration didn't fully populate the row — manual UPDATE needed before re-flipping to adaptive.

---

## Step 4 — Re-arming after the fix

After fixing the bug + redeploying, flip the rows back:

```bash
psql "$DATABASE_URL" <<'SQL'
UPDATE surveys
SET template = 'adaptive'
WHERE template = 'quick'
  AND mode = 'intelligent'
  AND legacy_journey_id IS NOT NULL;
-- Expect: UPDATE 10
SQL
```

Then re-run the adaptive smoke test:

```bash
set -a && source .env && set +a
node scripts/smoke-test-adaptive-engine.mjs
# Expect: 17/17 pass
```

---

## What the rollback does NOT undo

- The `'adaptive'` + `'custom'` enum values from migration 0018 — left in place. Postgres doesn't easily allow removing enum values, and they're inert when no row uses them.
- The Reviews survey settings cleanup (70 numeric junk keys removed) — left in place. The cleanup was strictly improvement; nothing breaks if it stays.
- The `is_positive` backfill from migrations 0016 + 0017 — out of scope for §2 rollback (those are §6 hotfix, separate rollback if needed).
- The `AdaptiveEngineService` code itself — stays deployed but inert (no rows route through it after the rollback).

---

## Owner-review list (FYI for engineers triaging)

These 3 Spice Garden surveys had empty `redirectLinks.google` before the migration and after. If the owner reports "happy path redirect goes nowhere" on these specific slugs, it's NOT a §2 bug — it's a pre-existing data gap. Tell the owner to set the URL in the adaptive form (yellow banner is shown in the editor).

| Survey | Slug |
|--------|------|
| Dine-In Feedback Journey | `dine-in-feedback-8152` |
| Delivery Feedback Journey | `delivery-feedback-3937` |
| Quick NPS Survey | `quick-nps-3629` |
