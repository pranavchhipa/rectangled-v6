# Hotfix PRD §7 — Chain Rollup merged into Dashboard

**Status:** Complete.
**Migrations:** none (FE + service refactor only).
**Tests:** 111 vitest pass; API tsc 0 errors; web tsc 24 (down from 25 baseline because the old chain page rewrite eliminated some of its own pre-existing errors).
**Source spec:** `docs/PRD_Hotfix_Customer_Journey_Rebuild.md` § 7.

---

## TL;DR

`/dashboard/chain` had ~90% data overlap with `/dashboard` and confused owners about which page to use. This hotfix:

1. **Deletes the standalone page.** `/dashboard/chain/page.tsx` becomes an 11-line `redirect('/dashboard')` so existing bookmarks resolve.
2. **Adds a `<ByLocationSection>` to the Dashboard** that conditionally renders the leaderboard + per-location trends + geo distribution. Single source of truth.
3. **Fixes a P0 scope bug:** chain endpoints used to scope by `organizationId`, which silently cross-mixed locations across sibling brands when an agency owned multiple workspaces. They now scope by `workspaceId`.
4. **Removes the "Chain rollup" sidebar item.**

---

## Conditional rendering threshold (read me before "fixing" the empty Dashboard)

```tsx
// apps/web/src/app/dashboard/page.tsx
{currentWorkspaceId && locationCount >= 2 && (
  <ByLocationSection workspaceId={currentWorkspaceId} locations={…} />
)}
```

**This is intentional.** Single-location workspaces don't see the "By Location" section. There's nothing to compare against itself, and the SMB owners who run a single shop don't need a leaderboard with one row.

The threshold is **exactly `>= 2`**. If you log into a workspace with only 1 location and don't see the leaderboard / trends / geo widgets, that's working as designed — not a bug. The signal you should look for instead:

| You see | Condition |
|---|---|
| Full Dashboard with "By Location" section | `locationCount >= 2` |
| Dashboard without "By Location" section | `locationCount < 2` (0 or 1 locations) |
| `/dashboard/chain` 404 | bug — the redirect stub should fire |
| `/dashboard/chain` rendering the old chain UI | bug — page.tsx didn't get rewritten |

The locationCount comes from `trpc.location.list({ workspaceId })`, same query the existing Dashboard already used for the location stat tile. No extra round-trip.

---

## Workspace scope correction (PRD §7.3)

### The bug

Chain endpoints all took `{ organizationId }` and joined `workspaces ON workspaces.organization_id = $1`, then aggregated reviews / escalations across every location in every workspace under the org. For an agency with 5 client brands, the chain view showed **all 5 brands' locations mixed together** with no way to scope.

### The fix

Every chain endpoint now takes `{ workspaceId, locationIds? }`:

| Endpoint | Before | After |
|---|---|---|
| `chain.getOverviewKpis` | `{ organizationId, dateFrom, dateTo }` | `{ workspaceId, dateFrom, dateTo, locationIds? }` |
| `chain.getLocationLeaderboard` | `{ organizationId, ..., sortBy, sortDir }` | `{ workspaceId, ..., locationIds?, sortBy, sortDir }` |
| `chain.getRatingTrendsByLocation` | `{ organizationId, locationIds?, ..., granularity }` | `{ workspaceId, locationIds?, ..., granularity }` |
| `chain.getGeoDistribution` | `{ organizationId, ... }` | `{ workspaceId, ..., locationIds? }` |
| `chain.getResponseTimeHeatmap` | `{ organizationId, ... }` | `{ workspaceId, ..., locationIds? }` |
| `chain.getEscalationLoad` | `{ organizationId }` | `{ workspaceId, locationIds? }` |

Service-layer:
- Permission check: `requireOrgAccess(organizationId)` → `requireOrgWorkspaceAccess(workspaceId)`. The latter validates org membership AND that the workspace is in the caller's scope (handles agency staff who only see specific clients).
- Queries: `JOIN workspaces ON workspaces.organization_id = $orgId` → filter `locations.workspace_id = $workspaceId` directly.
- Optional `locationIds[]`: when supplied, narrows to that subset within the workspace. Empty/undefined = all workspace locations.
- New private `resolveLocationIds()` helper centralizes the "all OR subset" lookup.

### Why this is safer

Before, an agency staff member with read access to one client's data could see another client's leaderboard if the rollup endpoint was hit with the wrong org id. The org-level membership check let them through. Now the workspace gate is precise: workspace ID in URL → workspace ID in scope check → workspace ID in query filter. Single anchor everywhere.

---

## Frontend layout

### Existing Dashboard widgets (untouched)

- Welcome card
- Hero metric cards (Total Reviews / Avg Rating / Response Rate / Active Journeys)
- Stats grid (Locations / Reviews / Connectors / Team)
- Onboarding checklist
- Quick-action cards

### New "By Location" section (renders below all of the above when `locationCount >= 2`)

- **Section header**: "By Location" + small "Compare performance across N locations." subhead, divided from the rest by a top border.
- **Filter dropdown** (multi-select Popover, top-right of section): "All N locations" or any subset. Empty selection = all.
- **Leaderboard** (sortable table):
  - Columns: Branch / Reviews / Avg★ / Response% / Open Esc / SLA breach%
  - Click any column header to flip sort direction.
  - SLA% colored red ≥30%, amber otherwise.
  - "Open Esc" badge amber when > 0.
- **Per-location rating trends** (Recharts multi-line chart):
  - One line per location, weekly granularity.
  - 0–5 Y axis, dates on X axis, 10-color rotating palette.
  - When the leaderboard filter narrows, this narrows too.
- **Geo distribution** (city-grouped list):
  - Locations grouped by city (state fallback if city is null).
  - Each group shows total reviews and per-location avg rating.
  - No actual map widget — `locations.lat`/`lng` aren't on the schema yet. Future: add columns + render a real map.

The 3 widgets all consume the same `locationIds` filter from the section's state, so picking 2 of 5 locations narrows leaderboard + trends + geo in lockstep without re-fetching the filter dropdown.

---

## Files touched

| File | Change |
|---|---|
| `packages/shared/src/validators/chain.ts` | All 6 schemas: `organizationId` → `workspaceId`; all gain optional `locationIds[]`. |
| `apps/api/src/chain/chain.service.ts` | All 6 methods refactored; new `resolveLocationIds` helper; permission check swapped. |
| `apps/web/src/components/dashboard/by-location-section.tsx` | NEW — section orchestrator + LocationFilterPopover + LocationsLeaderboard + PerLocationTrends + GeoDistribution. ~530 LOC. |
| `apps/web/src/app/dashboard/page.tsx` | Renders `<ByLocationSection>` conditionally on `locationCount >= 2`. |
| `apps/web/src/components/dashboard/sidebar.tsx` | "Chain rollup" item removed. |
| `apps/web/src/app/dashboard/chain/page.tsx` | 856-line page → 11-line redirect stub. |

---

## Done checklist (PRD §7.10)

- [x] `/dashboard/chain` page deleted (replaced with 11-line redirect)
- [x] `/dashboard/chain` redirects to `/dashboard`
- [x] Sidebar "Chain rollup" removed
- [x] Dashboard renders "By Location" section conditionally (`locationCount >= 2`)
- [x] Location filter dropdown works (multi-select Popover)
- [x] All 6 chain endpoints take `workspaceId` instead of `organizationId`
- [x] Service-layer queries filter by workspace, not org
- [x] Single-location workspace → no "By Location" section visible
- [x] Multi-location workspace → leaderboard + trends + geo all render
- [x] Switching between two workspaces in agency org shows only the active workspace's locations — verified by code inspection (`requireOrgWorkspaceAccess` gates), not by automated test (a multi-brand fixture doesn't exist in current prod).

---

## Pointers

- Section component: `apps/web/src/components/dashboard/by-location-section.tsx`
- Dashboard wiring: `apps/web/src/app/dashboard/page.tsx` (search for `ByLocationSection`)
- Service layer: `apps/api/src/chain/chain.service.ts`
- Validators: `packages/shared/src/validators/chain.ts`
- Permission helper: `apps/api/src/auth/permissions.ts` → `requireOrgWorkspaceAccess`
- Redirect stub: `apps/web/src/app/dashboard/chain/page.tsx`
- Source spec: `docs/PRD_Hotfix_Customer_Journey_Rebuild.md` §7
