# Phase 4 Execution Plan — Legacy Tables Read-Only

**Generated:** 2026-05-02 (post-Phase-3-backend)
**Source spec:** `PHASE_3_PLAN.md` § "Dual-write era" — *"Phase 4 makes legacy tables read-only. Phase 5+1mo drops them."*
**Goal:** Lock in the Phase 3 surveys merger by preventing any new writes to `journeys` / `truforms` / `journey_responses` / `truform_responses`. Existing rows stay readable for analytics back-compat. Phase 5 (T+1mo) will drop the tables entirely.

---

## 0. Why Phase 4

Phase 3 backfilled every existing journey/truform into `surveys` with `legacy_*_id` preserved, and the new survey engine + CRUD service is production-ready. But:

- Legacy `journey.create` / `truform.create` mutations still exist and still INSERT into the old tables.
- Legacy `journey.submitResponse` / `truform.submit` mutations still INSERT into the old response tables.
- Stage E (compat shim) routes legacy *URLs* through the new engine, but only Phase 4 closes the door on legacy *writes*.

Without Phase 4, the codebase silently splits new data across both regimes. After Phase 4:
- Every new survey/response goes to `surveys` / `survey_responses` only.
- Legacy writes return a clear `410 Gone` error pointing callers at `survey.*`.
- A DB trigger backstops the service-layer guard so even direct SQL gets blocked.

T+1 month after Phase 4 ships, Phase 5 drops the four legacy tables entirely.

---

## 1. Stage breakdown

### Stage A — Read-only enforcement (DB + service)

**Migration `0013_legacy_tables_readonly.sql`:**
- BEFORE INSERT/UPDATE trigger on `journeys`, `truforms`, `journey_responses`, `truform_responses`.
- Trigger raises an exception with a friendly message: *"This table is frozen as of Phase 4. Use surveys.* instead. See docs/PHASE_4_CHANGES.md."*
- `UPDATE` is blocked too — the only column we'd want to mutate is `archived_at`, but that flow is now "create a survey with `legacy_*_id` set + archive the old row" which is already done. After Phase 4 nobody updates legacy rows.
- DELETE is allowed (Phase 5 needs it; cascading cleanup logic might also need it).

**Service-layer guards** (clearer error messages than letting the trigger fire):
- `journey.service.create`, `update`, `updateScreens`, `submitResponse` → throw `TRPCError({code: 'GONE', message: 'Legacy journey writes are frozen. Use survey.* (template=quick).'})`.
- `truform.service.create`, `update`, `submit` → same with template=deep.
- `journey.service.bulkDeploy` → same.
- READ methods (`list`, `getById`, `getPublicJourney` etc) keep working — analytics still need them until Phase 5.

**Why both DB trigger + service guard:**
- Service guard gives clean tRPC error codes, doesn't cost a DB roundtrip.
- DB trigger backstops anything that goes around the service (direct psql, future migrations, third-party integrations).

### Stage B — Deprecation tests + changelog

**Tests** (vitest):
- `apps/api/src/journey/journey.service.deprecation.test.ts`:
  - `create` throws GONE
  - `update` throws GONE
  - `submitResponse` throws GONE
  - `list` still works (read path)
- Same shape for `truform.service`.

**Cross-table integrity check** (one-shot script):
- `scripts/verify-legacy-frozen.mjs` — confirms no INSERTs since the migration cutover; logs counts and most-recent created_at across all four tables.

**Changelog** `docs/PHASE_4_CHANGES.md`:
- Lists the affected mutations + the new error code consumers should expect.
- Calls out that READ paths still work (analytics, legacy URL routing through Stage E shim).
- Notes the Phase 5 timeline (T+1mo).

---

## 2. Risks & mitigations

| Risk | Mitigation |
|---|---|
| External integrations (webhooks, scripts, n8n) still hit the legacy mutations and break | Service-layer error message names the new endpoint explicitly. Operators see "use survey.create instead" and can update their integrations. |
| A migration we'll need to write later still wants to touch a legacy table | DELETE is allowed. INSERT/UPDATE blocked. If a future migration needs UPDATE, it can `ALTER TABLE … DISABLE TRIGGER` for the duration. |
| Compat shim (Phase 3 Stage E) wants to dual-write to legacy for transition safety | Stage E ships AFTER Phase 4. The shim writes ONLY to `surveys` / `survey_responses` from day one — that's the whole point of Phase 3. |
| Existing rows have `archived_at` updates pending from Stage E | Stage E does not modify legacy rows; it just routes the URL. No legacy UPDATE required. |

---

## 3. Migration numbering

Phase 0: 0001–0006. Phase 1: 0007–0009. Phase 2: 0010. Phase 3: 0011–0012. Phase 4 starts at 0013.

---

## 4. Order of operations this session

1. Stage A — write migration 0013, apply to prod, add service-layer guards.
2. Stage B — write deprecation tests, run them, write changelog.
3. Verify with `scripts/verify-legacy-frozen.mjs`.
4. Then move on to Phase 3 Stage E (compat shim) which routes the URLs through the new engine — Phase 4 going first means the shim has nothing to dual-write to even if it wanted to.

---

OK, executing Stage A now.
