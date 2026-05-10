---
type: concept
aliases: [RBAC, Permissions, Membership Check, requireMembership]
---

# Membership / RBAC

Permission rule layer. Every authenticated service call goes through `requireMembership(userId, workspaceId)` before doing real work.

## Where it lives
- API: `apps/api/src/common/` (guards / decorators)
- Memberships table: `packages/db/src/schema/members.ts`
- Org-level: `packages/db/src/schema/organization-members.ts`
- Role constants: `packages/shared/src/constants/roles.ts`, `organization-roles.ts`

## Roles (typical)
- Workspace: owner / admin / manager / staff
- Organization: org-owner / org-admin / member

## Checks
- `requireMembership(userId, workspaceId)` — the membership row must exist; some methods further check role tier.
- Some routes check ownership of a sub-row (e.g. only the assignee can resolve their own [[Escalations|escalation]]).

## Connects to
- [[Auth]] — provides userId
- [[Workspace-Scoping]] — gate on every workspace-scoped query
- [[Members]] — data source
- [[Organization]] — org-level checks
