# Phase 4 — Legacy tables read-only

**Status:** Complete (Stages A + B).
**Migrations applied:** 0013 (in production)
**Tests:** 74 passing (added 4 for legacy-frozen guard).
**Source spec:** `PHASE_4_PLAN.md`, originally referenced from `PHASE_3_PLAN.md` § "Dual-write era".

---

## TL;DR

Phase 3 unified `journeys` + `truforms` into `surveys` and backfilled every existing row. Phase 4 closes the door on new writes to the legacy tables. Existing rows stay readable for analytics — they get dropped in Phase 5 (T+1mo).

```
┌──────────────────┐   INSERT/UPDATE blocked   ┌─────────────┐
│ journeys         │ ──────────────────────────│ trigger:    │
│ truforms         │  ✗ "frozen as of Phase 4" │ raise_      │
│ journey_responses│                           │ legacy_     │
│ truform_responses│                           │ table_      │
└──────────────────┘                           │ frozen()    │
        ↓                                      └─────────────┘
   SELECT ✓ (read-only)
   DELETE ✓ (Phase 5 needs it)
```

---

## Stages shipped

### Stage A — Read-only enforcement (commit pending)

**Migration `0013_legacy_tables_readonly.sql`:**
- Defines `raise_legacy_table_frozen()` PL/pgSQL function — raises with a message naming `surveys.*` as the replacement.
- BEFORE INSERT OR UPDATE trigger on each of: `journeys`, `truforms`, `journey_responses`, `truform_responses`.
- DELETE intentionally not blocked (Phase 5 teardown + cascading deletes from workspaces still need to work).

**Service-layer guard `apps/api/src/common/legacy-frozen.ts`:**
- `throwLegacyFrozen(entity, operation)` — throws `TRPCError({code: 'METHOD_NOT_SUPPORTED'})` with a message like:
  > `[Phase 4] Legacy journey.create is no longer supported. Use survey.create / survey.update / survey.complete with template=quick instead. See docs/PHASE_4_CHANGES.md.`
- Return type is `void` (not `never`) so TypeScript control-flow analysis doesn't poison downstream type inference in the calling methods. Runtime behaviour is identical — the throw still propagates.

**Patched call-sites:**

`apps/api/src/journey/journey.service.ts` — guards added at the top of:
- `create`, `update`, `archive`, `updateScreens`, `submitResponse`, `seedDefault`, `bulkDeploy`

`apps/api/src/truform/truform.service.ts` — guards added at the top of:
- `create`, `update`, `activate`, `archive`, `submitResponse`

Read methods (`list`, `getById`, `getPublicJourney`, `getPublic`, `getResponses`, `getStats`, `getBulkSlugs`) and `truform.delete` are intentionally *not* guarded. Reads stay live for analytics until Phase 5; DELETE stays live for cleanup.

### Stage B — Tests + verification (commit pending)

**Vitest (`apps/api/src/common/legacy-frozen.test.ts`)** — 4 tests:
- Throws `TRPCError` with `METHOD_NOT_SUPPORTED` for journey + truform.
- Error message names the right replacement (`survey.create` + correct template).
- Mentions `docs/PHASE_4_CHANGES.md` so callers know where to look.
- Operation name is preserved verbatim across all 6 affected operations.

**Verification script `scripts/verify-legacy-frozen.mjs`:**
- Confirms the four triggers exist on the four legacy tables.
- Probes each table with an INSERT and confirms the Phase 4 error message comes back.
- Reports row counts + most-recent `created_at` for each legacy table (informational — useful for spotting any rows that snuck in).

**Production run (verified):**
```
[1/3] Trigger existence
  ✓ legacy_frozen_journeys / truforms / journey_responses / truform_responses (4/4)

[2/3] INSERT blocked
  ✓ all 4 legacy tables refuse INSERTs with the Phase 4 message

[3/3] Row counts (informational)
  journeys           10 rows  · latest: 2026-04-30
  truforms            5 rows  · latest: 2026-03-22
  journey_responses 224 rows  · latest: 2026-04-30
  truform_responses 151 rows  · latest: 2026-03-22

=== 8 pass, 0 fail ===
```

The latest timestamps match the Phase 3 backfill cutover — confirming nothing has written to legacy tables since Phase 3 shipped.

---

## What callers see

A client that hits a legacy mutation gets a tRPC `METHOD_NOT_SUPPORTED` with this message:

```
[Phase 4] Legacy journey.create is no longer supported.
Use survey.create / survey.update / survey.complete with template=quick instead.
See docs/PHASE_4_CHANGES.md.
```

The replacement endpoints are already live — Phase 3 Stage D (commit `b7adf97`) shipped the full `survey.*` tRPC surface (public engine + protected CRUD).

---

## Phase 5 (T+1mo)

Phase 5 drops the four legacy tables entirely. By that point:
- Stage E of Phase 3 (compat shim — coming next this session) will have routed `/j/{slug}` and `/f/{slug}` URLs through the new survey engine, so QR codes in the wild keep working without ever touching legacy tables.
- Analytics consumers will have migrated to read from `survey_responses` (which contains every row from both legacy response tables, with `legacy_*_response_id` preserved for cross-reference).

The migration for Phase 5 is essentially:
```sql
DROP TABLE truform_responses;
DROP TABLE journey_responses;
DROP TABLE journey_screens;
DROP TABLE truforms;
DROP TABLE journeys;
DROP TYPE truform_type, truform_status, journey_status;
```

Plus removing the legacy service files and routers. Tracked but deliberately not scheduled here — stays "T+1 month" so we have a window to spot anything that still reads from the old shape.

---

## Verification commands

```bash
# applied migrations
npm run db:migrate:status

# trigger + INSERT-block + row-count probe
node scripts/verify-legacy-frozen.mjs

# unit tests
npm test
```

---

## Commit log

```
<pending>  feat(phase-4): freeze legacy journeys + truforms (read-only)
933c4e2    docs(phase-4): execution plan — legacy tables read-only
```
