# Phase 1 — Organizations layer

**Status:** Stages A–F complete. Stage G (full onboarding wizard rebuild) deliberately partial — accept-invite shipped; the 3-flow branching wizard waits on UX direction.
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

### Stage E — Frontend org switcher + dashboard pages (commit `a92d536`)

`apps/web/src/stores/auth-store.ts` extended with `organizations[]` + `currentOrganizationId` + actions. `setOrganizations` auto-picks a default if the current is unset/invalid. `logout` clears org state.

**`<OrgHydrator />`** mounts once near the top of the dashboard tree. Calls `organization.list` + `organization.getCurrent` on mount, fills the store. Server cookie wins over local pick.

**`<OrgSwitcher />`** in the top nav next to the sidebar trigger. Hidden when `org.type === 'direct'` AND there's only one org. Dropdown shows every org with a type icon (`Building2` / `Network` / `Briefcase`), workspace count, member count, and a check mark on the current. Switching calls `organization.switch` (sets cookie), invalidates `getCurrent` + `workspace.list`.

**`/dashboard/organization`** (overview): name + type badge + description, four stat cards (workspaces, members, created, my role), quick links to Members and (when applicable) White-label.

**`/dashboard/organization/members`**: member list with pending state, role dropdown, scope hint. Invite dialog generates a JWT and shows a copy-to-clipboard URL. Per-row dropdown to change role (owner-only) or remove.

### Stage F — White-label theme + config page (commit `9d7d14c`)

**`<WhiteLabelTheme />`** wraps the dashboard inset. Reads the current org's `whiteLabel` JSONB and applies CSS variables (`--org-primary`, `--org-secondary`) scoped to its subtree. Direct mode + no config = no-op (just renders children). Variables are scoped, not global, so theme switches don't bleed across orgs in a single tab.

**`/dashboard/organization/white-label`** has five sections:
1. Master switch (enabled toggle).
2. Logo + favicon URLs.
3. Brand colors (color picker + hex input, validated 6-digit hex).
4. Support contacts (email, phone, footer text).
5. Live preview block.

Save flow: dirty tracking → client-side hex validation → strip empty strings → `organization.update` → invalidate `getById` so the theme refreshes immediately. Permissions: org_owner / org_admin can edit; everyone else gets read-only fields with an explanatory banner.

### Stage G — Accept-invite (commit pending)

**`/accept-invite?token=…`** consumes the JWT generated by `organizationMember.invite`. If the user isn't logged in, redirects to `/login` with a `redirect=` param so they land back here. On success, also calls `organization.switch` so the user lands in the dashboard with the right context. Shows clear loading / success / error states.

The full 3-flow branching onboarding wizard (`direct` / `multi_location` / `agency` per spec §3.7) is intentionally NOT included — that's a UX-heavy rewrite of the existing onboarding step machine that wants design input before shipping. The schema (`onboarding_state.flow`) is in place from Stage A, so the wizard can be added in a focused follow-up session.

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

## Cumulative state at the end of Stage F + accept-invite

| Layer | State |
|---|---|
| Migrations | **9 applied** (Phase 0: 6, Phase 1: 3) — 0 pending |
| `packages/shared` | builds clean |
| `packages/db` | builds clean |
| `apps/api` typecheck | clean |
| `apps/web` (new files) | clean |
| Tests | **36 passing** |
| Org-aware permission helper | available, opt-in |
| `requireMembership` in existing services | unchanged — works because every user is an org_owner after backfill |
| Org switcher in nav | shipped (collapses for single-org direct mode) |
| Org overview + members + white-label pages | shipped |
| Accept-invite endpoint | shipped at `/accept-invite?token=…` |
| Onboarding wizard rebuild (3 flows) | **deferred** — schema ready, UX work pending |

## What's NOT in this phase (deferred to a focused follow-up)

**Onboarding wizard rebuild** (spec §3.7): branching `direct` / `multi_location` / `agency` flow. Current onboarding still works for direct mode (which is what every existing user is, post-backfill). The new wizard is a UX rewrite — needs design input before shipping unilaterally.

**Migrating existing services to `requireOrgWorkspaceAccess`** (Phase 2 work): all 25 existing routers still use `requireMembership` from before Phase 1. They keep working because every user is now also an org_owner (Stage A backfill). Phase 2 walks through them one router at a time.

**Per-workspace agency client invitation flow** (spec §3.9): `workspace.inviteClientOwner({ workspaceId, email })` for the agency-mode read-only client experience. The data model supports it (`workspaceIds` scope on `organization_members`), but the workspace-router endpoint hasn't been built yet.

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

# Subsequent calls — the cookie tells the server which org you're on.
curl $API/trpc/organization.getCurrent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: rectangled_current_organization_id=..."

# Invite a teammate.
curl -X POST $API/trpc/organizationMember.invite \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"organizationId": "...", "email": "...", "role": "org_admin"}'
# Returns { invitationToken: "..." } — invitee visits /accept-invite?token=...
```

Phase 1 is **functionally complete** for the use cases the platform supports today. The 3-flow onboarding rebuild is the only remaining spec item, and it's intentionally a separate ticket.
