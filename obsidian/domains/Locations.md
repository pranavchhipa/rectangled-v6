---
type: domain
aliases: [Location, Locations Module]
---

# Locations

A workspace owns N locations (physical branches). Many domain rows are location-scoped on top of being workspace-scoped.

## Surface
- API: `apps/api/src/location/`
- Web: `apps/web/src/app/dashboard/locations/`, `apps/web/src/components/location/`
- DB: `packages/db/src/schema/locations.ts`
- Validators: `packages/shared/src/validators/location.ts`

## What it owns
- Address, hours, phone, GBP/Zomato IDs (per [[Connectors]])
- **Per-location branding overrides:** `brandingLogoUrl`, `brandColor`, `displayName` (top of [[Branding-Resolution]] chain)
- Future: `headerColor` (pending — see open items in `CLAUDE.md`)

## Filtering rules (Hotfix-5/6)
Per-page location filters were added in Hotfix-5 across:
- Customer Journeys, Responses, Customers, Dashboard rollups, custom journey wizard
Threshold for showing the filter UI was relaxed from `>= 2` to `>= 1` active locations in Hotfix-6 (single-location workspaces like Woof Nest were missing the UI). See [[Hotfix-Trail]].

**No global location switcher** — per Pranav's explicit ask. Location filtering is per-page.

Customers don't have a direct `location_id`; they resolve via subquery on `survey_responses.location_id`.

## Connects to
- [[Workspaces]] — parent
- [[Connectors]] — each location can connect to its own [[Google-Business-Profile|GBP]] / [[Zomato]] place IDs
- [[QR]] — QR codes are per-location
- [[Branding-Resolution]] — first override layer
- [[Reviews]], [[Customers]], [[Surveys]] — location-scoped queries
- [[Chain]] — for multi-location operators
