# Phase 1 Execution Plan — Organizations Layer

**Generated:** 2026-05-01 (post-Phase-0)
**Source spec:** `PRD_OptimizerV6_Master.md` § Phase 1 (lines 837–1376)
**Goal:** Add a layer above workspaces — direct / multi_location / agency modes. One backend, three product faces.

---

## 0. Scope reality check

This is bigger than Phase 0. The spec says 4 weeks. Touches:
- 2 new tables, 2 new enums, modify `workspaces` + `onboarding_progress`
- A new `requireOrgWorkspaceAccess` helper that **must replace** the current `requireMembership` calls in every protected procedure (~25 routers)
- New `organization` + `organizationMember` routers
- New cookie-based "current org" context
- 5+ new dashboard pages
- White-label CSS variable injection
- Onboarding rebuild (3 branching flows)
- Client invitation flow (agency-only)

Doing all of this in one session is reckless. Plan: split into 8 stages, ship each independently, never break what's already working.

---

## 1. Audit — what exists today

| Concept | Today | Phase 1 wants |
|---|---|---|
| Tenant root | `workspaces` | `organizations` (workspaces become children) |
| Permission gate | `requireMembership(workspaceId, userId)` in each service | `requireOrgWorkspaceAccess(ctx, workspaceId, capability)` — 3-step check |
| Auth context | JWT `{sub, email}` + Zustand `currentWorkspaceId` | + `currentOrganizationId` cookie + Zustand |
| Onboarding | Linear `onboardingProgress` table | + `flow: direct \| multi_location \| agency` branching |
| Branding | `workspaces.brandColors` | + `organizations.whiteLabel` (agency uses) |
| Member model | `members` (workspace-scoped) | + `organization_members` (org-scoped) — both coexist |

Workspaces stay as a real concept (locations roll up to workspaces, not directly to orgs). The change is that workspaces now belong to an organization, and access decisions read both layers.

---

## 2. Stage plan

### Stage A — Schema + backfill (foundation, no behaviour change)
**Migration 0007 + 0008 + 0009**

- Create enums: `organization_type` (direct / multi_location / agency), `organization_role` (org_owner / org_admin / org_manager / org_member).
- Create `organizations` table.
- Create `organization_members` table.
- Add `workspaces.organization_id` (nullable initially), `workspaces.client_metadata` JSONB.
- Add `onboarding_progress.flow` (default 'direct').
- Backfill: one direct org per existing workspace, set `organization_id`, copy members into `organization_members` (workspace owners → org_owner, others → org_member with workspaceIds = [their ws]).
- Set `workspaces.organization_id` to NOT NULL once backfill is verified.

**Why first:** Schema additions are reversible (drop column / drop table), don't change any code path, can sit in production for hours/days while we verify counts before shipping the code that uses them.

### Stage B — Permission helper (additive)
- Add `apps/api/src/auth/permissions.ts` with `requireOrgWorkspaceAccess()` that does the 3-step check (org membership → workspace scope → effective role / capability).
- Add capability constants + role-effective mapping (org_owner = workspace owner, etc.) in `packages/shared/src/constants/permissions.ts`.
- **Don't migrate existing services yet.** New procedures opt in. Existing services keep `requireMembership` and continue to work because every existing user has org_owner membership after Stage A's backfill.

### Stage C — Organization CRUD
- `apps/api/src/organization/organization.service.ts` + `organization.router.ts`
- `apps/api/src/organization/organization-member.service.ts` + `organization-member.router.ts`
- Wire into `trpc.router.ts`.
- Validators in `packages/shared/src/validators/organization.ts`.

### Stage D — Current-org context + cookie
- Server middleware reads `current_organization_id` cookie, verifies membership, attaches to ctx.
- New procedures use `ctx.currentOrganizationId` instead of asking the client to pass it every call.
- `organization.switch` mutation sets the cookie via tRPC response headers (or a small Express handler).
- Frontend Zustand store extended.

### Stage E — Frontend org switcher + nav
- Two-level switcher in dashboard nav (collapsed when org has 1 workspace).
- New `/dashboard/organization` overview page.
- New `/dashboard/organization/members` page.
- Hide org-related UI for direct mode (`org.type === 'direct'`).

### Stage F — White-label
- `organization.whiteLabel` JSONB shape (logoUrl, primaryColor, secondaryColor, footerText, supportEmail, supportPhone, customDomain).
- `organization.getWhiteLabel({ slug })` public query.
- CSS variable injection in `apps/web/src/app/layout.tsx` based on org.
- White-label config page at `/dashboard/organization/white-label`.

### Stage G — Onboarding rebuild + client invitation flow
- Wizard branching: direct / multi_location / agency.
- New invite flow: `workspace.inviteClientOwner({ workspaceId, email })` for agency mode.
- Onboarding step changes per flow.

### Stage H — Verification
- Smoke tests per spec checklist (3.11).
- Migrate one existing procedure to use `requireOrgWorkspaceAccess` and confirm it still works (proof of concept for the wider migration in Phase 2).

---

## 3. Risk assessment

| Risk | Mitigation |
|---|---|
| Backfill creates duplicate orgs for shared workspace owners | One workspace = one org always (we don't merge). If a user owns 5 workspaces today, they get 5 direct orgs after backfill. They can later upgrade one to multi_location and migrate workspaces in. |
| `organizationId NOT NULL` ALTER fails because some workspace had no accepted owner | Migration 0007 includes a fallback: if no accepted owner found, use `users` table's first super-admin OR fail loudly. Either way, no NULL slips through. |
| Permission helper conflicts with existing membership checks | Stage B is opt-in. Phase 1 doesn't migrate the 25 existing routers. Phase 2 does that with care. |
| Org switcher breaks workspace switcher | Test direct mode (1 workspace) carefully — the switcher should collapse, not double up. |
| White-label CSS leaks across orgs | CSS variables are scoped to the rendered request based on `currentOrganizationId`. SSR'd pages must avoid caching. |

---

## 4. What I'll do this session

Realistic one-session scope: **Stage A (schema + backfill)** as the standalone first commit. Verify it in production, then continue with Stages B-D depending on time and risk appetite.

If Stage A goes smoothly, continue:
- Stage B (helper, additive)
- Stage C (org routers, additive)
- Stage D (cookie context, additive)

Stop at "Stage E starts touching frontend" — that needs the user back at the keyboard for a UI-by-UI review. White-label, onboarding rebuild, and the org switcher are all UX decisions I shouldn't ship unilaterally.

---

## 5. Stage A detailed plan — what gets shipped first

**Files to add:**
- `packages/db/src/schema/organizations.ts`
- `packages/db/src/schema/organization-members.ts`
- `scripts/migrations/0007_organizations_schema.sql`
- `scripts/migrations/0008_workspaces_org_link_backfill.sql`
- `scripts/migrations/0009_workspaces_org_link_not_null.sql`

**Files to edit:**
- `packages/db/src/schema/enums.ts` — add `organization_type`, `organization_role`
- `packages/db/src/schema/workspaces.ts` — add `organizationId`, `clientMetadata`
- `packages/db/src/schema/onboarding.ts` — add `flow`
- `packages/db/src/schema/relations.ts` — wire org → workspace, org → org_members
- `packages/db/src/schema/index.ts` — export new schemas

**No code in apps/api or apps/web changes in Stage A.** That's the point — all schema, no behaviour change. Existing `members`-based permissions still work because every workspace will have an `organizationId` after backfill, and every workspace owner becomes an `org_owner`.

---

## 6. Approval & open questions

Same defaults as Phase 0 unless you say otherwise:
- Stage-grouped deploys (one deploy per stage)
- Colocated tests via vitest
- No CI yet — runtime guards on `db:push`

**Open question for now:** in the backfill, what slug do new organizations get? Options:
- `{workspace.slug}-org` — readable, predictable, fits in 100 chars (workspace slugs are <100 char too, easy)
- A fresh UUID-based slug — neutral but ugly

**My choice:** `{workspace.slug}-org`, truncated to 100 chars if needed. Easy to debug; the slug is mostly for vanity URLs anyway.

---

OK, executing Stage A now.
