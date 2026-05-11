---
type: domain
aliases: [Workspace, Workspaces Module]
---

# Workspaces

The unit of tenancy. Every domain row is workspace-scoped — see [[Workspace-Scoping]].

## Surface
- API: `apps/api/src/workspace/`
- Web: `apps/web/src/components/workspace/`, settings under `apps/web/src/app/dashboard/settings/`
- DB: `packages/db/src/schema/workspaces.ts`
- Validators: `packages/shared/src/validators/workspace.ts`
- Types: `packages/shared/src/types/workspace.ts`

## What it owns
- Display name, slug, logo, **brand colors** (used in [[Branding-Resolution]])
- White-label flags (`white_label.enabled`, `white_label.footerText`) — see [[White-Label]]
- `settings` JSONB — timezone, AI auto-respond, response-delay window, frequency caps, customer rate caps, and (Phase 2 `29393f7`) **`defaultRedirectLinks`** = `{ google?, zomato?, swiggy? }` — the URLs the survey engine falls back to for [[Customer-Journeys|Journey A Step 3a.1]]. Populated by [[Onboarding]] Step 4.
- Belongs to an [[Organization]]
- Has many [[Locations]], [[Members]], [[Customers]], [[Reviews]], etc.

## Connects to
- [[Organization]] — parent
- [[Members]] — many-to-many with users via memberships
- [[Locations]] — workspace owns N locations (single-location fall-through is a [[Branding-Resolution]] rule)
- [[Branding-Resolution]] — workspace defaults beat system defaults but lose to per-location overrides
- [[Workspace-Scoping]] — frontend `useQuery` pattern with `enabled: !!currentWorkspaceId`

## Notes
- Switching workspace = setting `currentWorkspaceId` in Zustand → triggers React Query refetch across the app.
- Workspace deletion is rare; soft-delete pattern via flags rather than `DELETE`.
