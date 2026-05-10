---
type: domain
aliases: [Organization, Org]
---

# Organization

Top-level container above [[Workspaces]]. One organization can own multiple workspaces (e.g., an agency managing multiple SMBs, or a chain). Holds the white-label flag.

## Surface
- API: `apps/api/src/organization/`
- Web: `apps/web/src/app/dashboard/organization/`
- DB: `packages/db/src/schema/organizations.ts`, `organization-members.ts`
- Validators: `packages/shared/src/validators/organization.ts`
- Constants: `packages/shared/src/constants/organization-roles.ts`

## What it owns
- `white_label.enabled`, `white_label.footerText` — see [[White-Label]]
- Org-level memberships (separate from workspace memberships)
- Branding fall-through ceiling (workspace beats org beats system)

## Connects to
- [[Workspaces]] — child relationship
- [[White-Label]] — public pages read `organizations.white_label`
- [[Members]] — workspace-level memberships are separate from org-level ones
- [[Branding-Resolution]]

## Notes
- For most SMB customers (single workspace), the org layer is invisible — just a parent row.
