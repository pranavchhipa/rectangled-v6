# Phase 2 — Multi-location chain UX (backend)

**Status:** Backend complete (Stages A → C + F). Frontend stages (D, E, G) deferred for UX review.
**Migrations applied:** 0010 (in production)
**Tests:** 53 passing (added 17 for scope-resolution)
**Source spec:** `PRD_OptimizerV6_Master.md` § Phase 2

---

## Stages shipped

### Stage A — Schema (commit `50d9288`)
Migration `0010_rule_inheritance_and_sla_targets.sql`. Pure additive.

- `automation_rules` + `escalation_rules` gain `scope` (default 'workspace'), `organization_id`, `location_id`, `overrides_rule_id` (self-FK). Partial indexes on org-scope and location-scope.
- New `location_sla_targets` table — per-location aspirational metrics.
- `onboarding_state.flow` was already added in Phase 1; nothing new here.

### Stage B — Rule engine resolves by scope (commit `951bca8`)

`apps/api/src/automation/scope-resolution.ts` (NEW): pure helper `resolveRulesByScope<R>(rules, ctx)`. 17 unit tests.
- Filters rules whose scope-id matches the context.
- Groups by `(triggerEvent, actionType)`.
- Picks highest scope per group (`location > workspace > organization`).
- Honours "disabled at higher scope blocks lower scope": if every rule at the top scope is `isActive=false`, the group fires nothing.
- Multiple active rules at the same winning scope all fire.

`automation.service.triggerAutomation` extended:
- Context gained optional `organizationId` + `locationId`. Derived server-side from workspace + source row when missing.
- Loads candidate rules across all 3 scopes; resolver picks winners.
- Existing journeyId filter still applies (workspace-scope only).

Existing rules continue to fire exactly as before (every existing row has `scope='workspace'`).

### Stage C — Chain rollup API (commit `56ca7c1`)

`packages/shared/src/validators/chain.ts` — six Zod schemas.

`apps/api/src/chain/chain.service.ts`:
- `getOverviewKpis` — top-strip KPIs for the dashboard.
- `getLocationLeaderboard` — per-location row stats, sortable by any column.
- `getRatingTrendsByLocation` — multi-line trend (top 10 by review count when locationIds omitted), granularity day/week/month via PG `date_trunc`.
- `getGeoDistribution` — pin per location with stats. lat/lng currently null (locations table doesn't have lat/lng yet — frontend can geocode city/state, or a future migration adds the columns).
- `getResponseTimeHeatmap` — bucket reviews by `(day-of-week, hour)`, avg minutes-to-first-reply per bucket.
- `getEscalationLoad` — per-location open + slaBreached snapshot.

All gated by `requireOrgAccess`. Default window: last 30 days.

### Stage F — Bulk operations (commit `68543ee`)

**Journey:**
- `journey.bulkDeploy({ sourceJourneyId, targetLocationIds[], customizePerLocation? })` — clones the source journey to N locations. Each clone gets a fresh slug, copies the metric_question screen config, auto-fills the per-location Google review URL. Max 100 locations.
- `journey.getBulkSlugs({ journeyIds[] })` — feeds QR pack generation. Max 200.

**Location:**
- `location.bulkUpdate({ ids[], patch })` — partial patch to N locations in one UPDATE.
- `location.setSlaTarget({ locationId, ...fields })` — upsert per-location aspirational targets.
- `location.bulkSetSlaTarget({ locationIds[], target })` — apply same target to N locations.
- `location.getSlaTarget({ locationId })` — read one.

QR pack ZIP/PDF generation deliberately stays client-side (frontend uses `qr.generateJourneyQr` per slug + `jszip`-style packaging). Avoids server-side archiver/PDF dependency creep.

---

## What's deferred (frontend — UX-heavy)

**Stage D — Chain rollup dashboard** at `/dashboard/chain`. KPI strip, location leaderboard table, comparative trend charts, geographic view (pins or choropleth). Visible only when `org.type IN ('multi_location', 'agency')`. Backend has every endpoint it needs.

**Stage E — Rule inheritance UI** in `/dashboard/automations` and `/dashboard/escalations/rules`. Scope tabs (Org / Workspace / Location). "Override at this location" affordance. Visual inheritance chain on each rule card.

**Stage G — Per-location SLA target UI** in location detail page. Numeric inputs for each target. Bulk-set affordance from chain leaderboard. Color coding in the leaderboard once targets are set.

These are visual decisions that benefit from human review before shipping unilaterally. The data layer is fully ready.

---

## Cumulative state

| Layer | State |
|---|---|
| Migrations | **10 applied** (Phase 0: 6, Phase 1: 3, Phase 2: 1), 0 pending |
| `packages/shared` | builds clean |
| `packages/db` | builds clean |
| `apps/api` typecheck | clean |
| Tests | **53 passing** |
| Rule engine scope precedence | live |
| `chain.*` router | live |
| Bulk journey deploy | live |
| Per-location SLA targets | live |
| Frontend chain UI | **deferred** — backend ready |

---

## How to test the new endpoints today

```bash
# Get chain KPIs (rolled up across every location in the org).
curl $API/trpc/chain.getOverviewKpis \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"organizationId": "..."}'

# Per-location leaderboard, sorted by review count.
curl $API/trpc/chain.getLocationLeaderboard \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"organizationId": "...", "sortBy": "reviews", "sortDir": "desc"}'

# Deploy a journey to 5 locations in one call.
curl -X POST $API/trpc/journey.bulkDeploy \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sourceJourneyId": "<source-journey>",
    "targetLocationIds": ["loc-1", "loc-2", "loc-3", "loc-4", "loc-5"]
  }'
# Response: { deployedJourneys: [{ locationId, journeyId, slug }, ...] }

# Set SLA targets for one location.
curl -X POST $API/trpc/location.setSlaTarget \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "locationId": "...",
    "reviewResponseSlaMinutes": 240,
    "escalationResolveSlaMinutes": 60,
    "csatTargetPercent": 80
  }'

# Set the same target on 20 locations.
curl -X POST $API/trpc/location.bulkSetSlaTarget \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "locationIds": ["...", "..."],
    "target": { "csatTargetPercent": 80, "npsTargetScore": 50 }
  }'

# Create an org-level automation rule. Fires for every workspace in the org.
curl -X POST $API/trpc/automation.createRule \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "workspaceId": "<some-ws>",
    "name": "Org thank-you",
    "scope": "organization",
    "organizationId": "<org-id>",
    "triggerEvent": "journey_completed_positive",
    "actionType": "send_message",
    "delayMinutes": 4320,
    "actionConfig": {"channel": "whatsapp", "templateId": "thank-you"}
  }'
# (Note: the existing createRule validator may need scope/organizationId
# fields exposed in the validator — Phase 2 frontend stage E ships that.
# The DB columns and engine support it today; only the validator needs
# updating to allow it from the API surface.)
```

---

## Known gaps (worth a follow-up)

1. `automation.createRule` and `escalation.createRule` validators don't yet expose the new `scope` / `organizationId` / `locationId` fields. The columns and engine handle them, but the input validators reject them. A small follow-up: extend `createAutomationRuleSchema` and the equivalent escalation rule schema. (UI stage E was going to do this; the validator side can ship without UI.)

2. `locations` table has no `lat`/`lng` columns. The `chain.getGeoDistribution` endpoint returns `null` for both. Frontend can geocode city+state client-side as a temporary measure, or a future migration adds the columns + a backfill step.

3. No automated tests for the SQL-heavy chain endpoints. They're tested via integration when there's data; unit-testing PG-specific aggregations needs a test DB. Lower priority than shipping.

Phase 2 backend is otherwise feature-complete.
