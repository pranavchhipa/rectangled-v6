---
type: domain
aliases: [Members, Membership]
---

# Members

A **membership** joins a user to a workspace with a role. Permission checks go through `requireMembership()` — see [[Membership-RBAC]].

## Surface
- API: `apps/api/src/member/`
- Web: `apps/web/src/app/dashboard/members/`, `apps/web/src/components/member/`
- DB: `packages/db/src/schema/members.ts` (workspace memberships), `organization-members.ts` (org-level)
- Validators: `packages/shared/src/validators/member.ts`
- Constants: `packages/shared/src/constants/roles.ts`, `organization-roles.ts`

## Roles
- Workspace roles (typical): owner, admin, manager, staff
- Organization roles: see `constants/organization-roles.ts`
- Role capabilities are checked inside services via guards in `apps/api/src/common/`

## Flows
- Invite by email → token-link in email ([[Email]]/[[Resend]])
- Accept invite → `apps/web/src/app/accept-invite/`
- List + remove members from settings page

## Connects to
- [[Auth]] — invite acceptance creates a user if none exists
- [[Workspaces]] — membership is the edge between user and workspace
- [[Organization]] — separate `organization-members` table for org-level roles
- [[Membership-RBAC]] — the rule layer

## Notes
- Hotfix-2 fixed a QR generator bug where `membershipId` was missing — keep it required in QR validators (see [[QR]]).
