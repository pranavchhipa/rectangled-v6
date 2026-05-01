# Phase 0 — Production safety fixes

**Branch:** `main` (stage-grouped commits)
**Status:** ✅ Complete
**Migrations applied:** 0001 → 0006 (all in production)
**Tests:** 22 passing

This is the audit-driven log of what shipped in Phase 0. The original spec is `PRD_OptimizerV6_Master.md` § Phase 0; the audit-driven plan is `PHASE_0_PLAN.md` at the repo root.

---

## What broke before Phase 0 (the diagnoses)

Two **silent zero-call code paths** were uncovered during the audit:

1. `AutomationService.processQueue()` was defined but **never invoked** by any cron or HTTP handler. Every automation rule that had triggered for months had enqueued a row that sat `status='pending'` forever. No coupons were ever sent via automations. No follow-up messages. No automation-path AI replies. (Inbox AI replies kept working because they go through `review.generateResponse`, not the automation handler.)
2. `CxRoutingService.evaluateReview()` was defined but **also had no callers**. So escalations had effectively never auto-fired in production. Only manual escalations existed.

Both are now wired — but only after the surrounding safety net (idempotency dedup, watchdog, rate caps, approval gates) was in place. Order mattered.

---

## What shipped, by stage

### Stage A — Migration discipline (PRE)
**Commit:** `9cbc3c9`
**Migrations:** none (foundation only)

- `scripts/migrate.mjs` — custom tracked-migration runner. Creates `_app_migrations` on first run, applies SQL files in order, each in a transaction.
- `scripts/db-push-guard.mjs` — wraps `drizzle-kit push`, refuses to run when `NODE_ENV=production` (drizzle-kit's introspection wants to drop ~50 NOT NULL constraints in this codebase — known unsafe).
- `scripts/migrations/` folder ready for the actual migrations.
- `docs/MIGRATIONS.md` — full discipline doc.
- `package.json` scripts updated: `db:push` goes through the guard; `db:migrate`, `db:migrate:status`, `db:migrate:dry-run` added.

### Stage B — Stop the bleeding
**Commit:** `962e621`
**Migrations:** `0001_automation_queue_idempotency.sql`

| Fix | What |
|---|---|
| **1** | `automation_queue.trigger_key` + partial unique index on `(rule_id, trigger_key)`. `triggerAutomation()` uses `onConflictDoNothing` with deterministic per-source keys (`jcp:{journeyResponseId}` etc.). Helper `apps/api/src/automation/triggerKey.ts` + 7 unit tests. |
| **13a** | `AutomationQueueCron` (`@Cron(EVERY_MINUTE)`) actually calls `processQueue()`. Single-instance guard via local `running` flag. Kill switch: `AUTOMATION_WORKER_ENABLED=false`. |
| **13b** | `AutomationWatchdogCron` (every 2 min) flips rows stuck in `processing` for >10 min back to `pending`. |
| **9** | `gbpAdapter.replyToReview` and WapiSnap client both accept `opts.idempotencyKey` and forward it as `X-Idempotency-Key`. Worker generates `auto-{queueId}-{attempts}`. GBP's PUT is naturally idempotent; WapiSnap support is best-effort (queue dedup is the primary defense). |

Order rationale: idempotency-first, worker-second, watchdog-third, outbound tokens last. Otherwise turning the worker on with a duplicate-permitting queue could cause double sends from the existing backlog.

### Stage C — Escalation hardening
**Commit:** `a45a2d3`
**Migrations:** `0002_internal_jobs.sql`, `0003_escalation_hardening.sql`, `0004_escalation_columns_and_indexes.sql`

Migrations split because PG won't let you USE a freshly-added enum value in the same transaction it was added.

| Fix | What |
|---|---|
| **3** | New `internal_jobs` table for system async work. `InternalJobsService.enqueue/process/resetStuck`. `InternalJobsCron` (30s tick + 2 min watchdog). `CxRoutingModule.onModuleInit` registers `escalation.evaluate` handler. `ReviewService.performSync` now enqueues `escalation.evaluate` AND fires `review_posted` / `review_posted_google` automation triggers when a new review inserts. |
| **6** | Two partial unique indexes on `escalations` (review-keyed and customer-keyed for manual cases). New `escalateManual()` service method first looks up an existing open manual case for the same source; returns it (`{created:false}`) instead of inserting. Click-spam → 1 case. |
| **5** | `paused` added to `escalation_status` enum. New columns: `paused_at`, `paused_reason`, `total_pause_seconds`. New service methods `pauseEscalation()` / `resumeEscalation()`. `checkSlaBreaches()` uses effective deadline = `slaDeadline + (totalPauseSeconds || 'seconds')::interval`. |
| **11** | When an `assignToRole` has no available members, falls back to workspace owner and inserts a `notifications` row of type `routing_failed` so the team knows the rule's role config is broken. `routing_failed` added to `notification_type` enum. |
| **12** | New service methods + tRPC procedures: `bulkAssign`, `bulkResolve`, `bulkClose`, `bulkUpdatePriority`. Max 100 IDs per call (server-enforced). |

Note: **Fix 10 was already implemented** at `cx-routing.service.ts:475+` (`pickRoundRobinUser`) — the audit confirmed load-based assignment was already in place.

### Stage D — Customer-experience guardrails
**Commit:** `c0479ce`
**Migrations:** `0005_automation_cooldowns_and_rate_caps.sql`

| Fix | What |
|---|---|
| **4** | `automation_rules.cooldown_hours INTEGER` (NULL = no cooldown). `triggerAutomation()` skips enqueue if same `(rule, customer)` was queued within the window. Migration backfills 2160h (90 days) for existing `send_coupon` rules. Validators accept 0–8760 hours. Index on `(rule_id, customer_id, created_at)` keeps the lookup cheap. |
| **8** | `workspaces.settings.customerRateCap` with `maxMessagesPerDay` (default 3), `maxCouponsPerMonth` (1), `maxActionsPerWeek` (10). Worker `processQueue()` calls `checkCustomerRateCap` BEFORE marking row `processing`. If over limit, marks `cancelled` with reason in `lastError`. Backfilled into all workspace rows. |

### Stage E — AI reply approval gate
**Commit:** `56d69bd`
**Migrations:** `0006_ai_reply_default_approval.sql`

| Fix | What |
|---|---|
| **2** | `executeAiReplyToReview` reads two new `actionConfig` keys: `requireApproval` (default `true`), `autoApproveMinRating` (default `5`). Reviews below the cutoff land in `reviewResponses` as `status='draft'` with `generatedBy='ai'` for the owner to approve in the inbox. Reviews at/above the cutoff auto-post to GBP, then the row is marked `posted`. New tRPC procedure `review.listPendingAiApprovals` for the inbox UI to surface pending drafts. Migration backfills the actionConfig of every existing `ai_reply_review` rule. |

---

## Full migration trail

```
0001_automation_queue_idempotency        Fix 1
0002_internal_jobs                       Fix 3
0003_escalation_hardening                Fix 5 + 11 (enum additions)
0004_escalation_columns_and_indexes      Fix 5 + 6 (columns + indexes)
0005_automation_cooldowns_and_rate_caps  Fix 4 + 8
0006_ai_reply_default_approval           Fix 2
```

Verify in any environment:
```
npm run db:migrate:status
```

---

## What's still TODO (out of Phase 0 scope, called out for Phase 1+)

- **Frontend work for Stage E**: the inbox needs a "Pending AI approval" filter + side-by-side review-vs-draft + Approve/Edit/Reject buttons. The backend procedure (`review.listPendingAiApprovals`) is ready; the UI is a Phase 1 ticket.
- **Frontend work for Stage C**: the escalations queue needs checkboxes + bulk action toolbar. Backend mutations are ready (`escalation.bulkAssign` etc.); the UI work is Phase 1.
- **Pause UI**: `escalation.pauseEscalation` / `resumeEscalation` need a button on the case detail page with a reason picker.
- **Cooldown UI**: rule editor needs a "Cooldown per customer" input.
- **Rate-cap UI**: workspace settings page needs a "Customer rate caps" section with three numeric inputs.
- **Notifications dispatch**: Fix 11 inserts `routing_failed` notification rows but there's no real-time push; relies on the inbox pulling.

These are all additive frontend features, not safety regressions. The platform is safe for paying customers as of `56d69bd`.

---

## Verification snapshot (at the time of writing)

| Check | Result |
|---|---|
| Migrations applied to prod | 6/6 ✓ |
| `packages/shared` build | clean |
| `packages/db` build | clean |
| `apps/api` typecheck | clean |
| `apps/web` journey/inbox files | clean (other modules' pre-existing errors unchanged) |
| Tests | 22/22 passing |
| Production worker enabled | `AUTOMATION_WORKER_ENABLED` not set ⇒ default ON |

---

## Operator runbook

### Disable all automation work without redeploy
```
AUTOMATION_WORKER_ENABLED=false
```
Disables both the automation queue worker (Fix 13a) AND the internal jobs worker (Fix 3). Watchdogs (Fix 13b) also pause. The existing rows stay in their current status.

### Inspect the queue
- Pending: `SELECT * FROM automation_queue WHERE status='pending' ORDER BY scheduled_for`
- Failed: `SELECT * FROM automation_queue WHERE status='failed' ORDER BY updated_at DESC LIMIT 50`
- Stuck (watchdog candidates): `SELECT * FROM automation_queue WHERE status='processing' AND updated_at < NOW() - INTERVAL '10 min'`
- Cancelled by rate caps: `SELECT * FROM automation_queue WHERE status='cancelled' AND last_error LIKE 'customer_rate_cap%'`

### Add a new schema change
1. Edit `packages/db/src/schema/*.ts`.
2. Write `scripts/migrations/NNNN_descriptive.sql`.
3. Test locally: `DATABASE_URL=<local> npm run db:migrate`.
4. Commit both.
5. Deploy. Production runs `npm run db:migrate` automatically (or via your deploy script).

Never run `drizzle-kit push` against production — `db:push-guard.mjs` blocks it.
