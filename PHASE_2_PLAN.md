# Phase 2 Execution Plan — Multi-location Chain UX

**Generated:** 2026-05-01 (post-Phase-1)
**Source spec:** `PRD_OptimizerV6_Master.md` § Phase 2 (lines 1379–1678)
**Goal:** Make multi-location and agency org types feel first-class. Chain rollup dashboard, rule inheritance, bulk operations.

---

## 0. What Phase 2 actually is

Today's product treats each workspace as an island. A 50-location chain owner has to:
- Configure the same automation rule 50 times
- Click into each workspace separately to see how it's doing
- Have no view of "location X is 4.1 stars vs chain avg of 4.6"

Phase 2 fixes this with three things:

1. **Chain rollup dashboard** — cross-workspace KPIs, location leaderboard, comparative charts, geographic view. Visible only when `org.type IN ('multi_location', 'agency')`.
2. **Rule inheritance** — automation_rules and escalation_rules gain a `scope` column. `organization > workspace > location` resolution at trigger time. Set a rule once at org level, override per location only when needed.
3. **Bulk operations** — deploy a journey to N locations in one click; generate a QR pack for printing; bulk-update location SLA targets.

---

## 1. Stage breakdown

### Stage A — Schema (pure additive)
Migration adds:
- `automation_rules.scope` ('organization' | 'workspace' | 'location') with default 'workspace'
- `automation_rules.organization_id` FK (cascade)
- `automation_rules.location_id` FK (cascade)
- `automation_rules.overrides_rule_id` self-FK
- Same four columns on `escalation_rules`
- New table `location_sla_targets`
- Indexes on (org_id where scope=org), (loc_id where scope=loc) per spec

No code changes yet — Stage B uses these columns.

### Stage B — Rule engine inheritance
Update `AutomationService.triggerAutomation` and `CxRoutingEngine.evaluateReview` (or wherever escalation rules are resolved) to:
1. Load matching rules at all three scopes for the event.
2. Group by `(triggerEvent, actionType)`.
3. Pick the highest-specificity rule per group (`location > workspace > organization`).
4. Multiple rules at the same specificity? All fire (existing behaviour — still N rules per scope).

Critical care: existing workspace-scope rules (the only kind that exist post-backfill) keep firing exactly as before.

### Stage C — Chain rollup API (`chain.*` router)
- `chain.getOverviewKpis` — total locations, avg rating, response rate, etc.
- `chain.getLocationLeaderboard` — sortable per-location stats
- `chain.getRatingTrendsByLocation` — multi-line trend
- `chain.getGeoDistribution` — pin/lat-lng data
- `chain.getResponseTimeHeatmap` — day-of-week × hour grid
- `chain.getEscalationLoad` — per-location open count

All gated by `requireOrgAccess`. Returns rolled-up data across the org's workspaces.

### Stage D — Chain dashboard frontend (deferred to next session)
`/dashboard/chain` — KPI strip, leaderboard table, trend charts, geo map. Heaviest UX work. Saves visual decisions for human review.

### Stage E — Rule inheritance UI (deferred)
Scope tabs in `/dashboard/automations` and `/dashboard/escalations/rules`. "Override at this location" affordance. Visual inheritance chain.

### Stage F — Bulk operations
- `journey.bulkDeploy({sourceJourneyId, targetLocationIds, customizePerLocation?})` — clones the source journey N times, returns the new ones.
- `journey.generateBulkQrPack({journeyIds, format})` — ZIP/PDF of QR codes.
- `location.bulkUpdate({ids, patch})` — already supports a partial patch via existing `update`, just iterate.
- `location.bulkSetSlaTarget({locationIds, target})` — upsert into location_sla_targets.

### Stage G — Per-location SLA targets UI (deferred)
Field set in location detail page. Phase 2 closeout.

---

## 2. Risk assessment

| Risk | Mitigation |
|---|---|
| Existing rules break when engine adds scope filter | Stage B keeps `scope='workspace'` (the migration default) firing exactly as today. New scopes only fire when set. |
| Rule resolution returns dupes across scopes | Group by (event, action) and take highest specificity ones. Multiple rules at same specificity all fire (matches today's behaviour). |
| Bulk journey deploy creates duplicate slugs | Slug generation is randomised already (`j-{10char-uuid}`). Each clone gets a fresh slug. |
| Location SLA breach calculation gets complicated | Scope is per-location; existing `slaMinutes` on rules still wins for the rule itself. SLA targets are aspirational metrics, not enforcement. |

---

## 3. What this session will ship

Stages **A → C** (backend only). After this session:
- Schema supports rule inheritance.
- Engine resolves rules by scope.
- The `chain.*` router has every endpoint the spec mentions.

That gives anyone wanting to build the frontend everything they need — no API blockers.

Frontend (D, E, F, G) is a separate session. Dashboard pages, scope tabs in rule editor, bulk-deploy flow, SLA target inputs.

---

## 4. Decisions to make explicit

- **Rule scope default**: `'workspace'`. Existing rows keep their meaning.
- **Resolution precedence**: location > workspace > organization. Spec confirms.
- **`isActive=false` at higher scope**: blocks lower-scope rules (per spec §4.2). The engine's group-by-and-pick-highest already enforces this naturally if I include disabled rules in the candidates and let "highest scope wins" exclude lower ones.

  Actually re-reading the spec: "Disabled (isActive=false) at higher specificity blocks lower specificity from firing." That means: if there's a `location` rule for (event, action) but it's `isActive=false`, the workspace rule for that pair should NOT fire either. This is *non-trivial* — needs explicit logic. Will handle in Stage B.

- **Overrides relationship**: `overrides_rule_id` is informational. The engine uses scope precedence, not the explicit FK. The FK is for the UI to render the inheritance chain.

---

## 5. Migration numbering

Phase 0 used 0001–0006. Phase 1 used 0007–0009. Phase 2 starts at 0010 (the spec used 0030, but we're contiguous).

OK, executing Stage A now.
