/**
 * Phase 1 — Organization roles and the mapping to effective workspace roles.
 *
 * Two membership tables coexist (Phase 1 intentional):
 *   - `members` (workspace-scoped, role: owner/manager/staff/viewer)
 *   - `organization_members` (org-scoped, role: org_owner/org_admin/org_manager/org_member)
 *
 * Effective role inside a workspace = max(workspace member role, derived from org role).
 *
 * Mapping derived-from-org:
 *   org_owner   → owner       (full control of every workspace in the org)
 *   org_admin   → owner       (same, except cannot delete the org itself)
 *   org_manager → manager     (in scoped workspaces; full org access if workspaceIds=NULL)
 *   org_member  → staff       (in scoped workspaces; lowest org-level access)
 *
 * Special case — agency client owner:
 *   org_member with workspaceIds=[their workspace] → effective role 'viewer' (read-only)
 *   This is distinguished by the workspaceIds restriction, not the role.
 *
 * The role union (workspace's own role plus org-derived role) decides what
 * the user can do. We always pick the *higher* of the two when both exist.
 */
import { ROLES, type Role } from './roles'

export const ORG_ROLES = {
  OWNER: 'org_owner',
  ADMIN: 'org_admin',
  MANAGER: 'org_manager',
  MEMBER: 'org_member',
} as const

export type OrgRole = (typeof ORG_ROLES)[keyof typeof ORG_ROLES]

/**
 * Map an org role to the workspace-scoped role it implies. Used as the
 * baseline; the effective role is `max(orgDerivedRole, workspaceRole)`.
 */
export function orgRoleToEffectiveRole(orgRole: OrgRole): Role {
  switch (orgRole) {
    case 'org_owner':
    case 'org_admin':
      return ROLES.OWNER
    case 'org_manager':
      return ROLES.MANAGER
    case 'org_member':
      return ROLES.STAFF
  }
}

/**
 * Role rank (higher = more permissions). Used to pick the higher of two
 * roles when computing effective access.
 */
const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  manager: 3,
  staff: 2,
  viewer: 1,
}

export function maxRole(a: Role, b: Role): Role {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b
}

/**
 * Effective role calculation given:
 *   - the user's org-level role (always present after Phase 1 backfill)
 *   - the user's workspace-level role if they have one (legacy `members`
 *     table; may be undefined for users invited via the org layer only)
 *   - whether the user's workspaceIds restriction includes this workspace
 *     (NULL = unrestricted)
 *
 * Returns null if the user cannot access this workspace at all.
 */
export function computeEffectiveRole(args: {
  orgRole: OrgRole
  workspaceRole: Role | null
  workspaceIds: string[] | null
  workspaceId: string
}): Role | null {
  // Scope check: if workspaceIds is set and doesn't include this workspace, deny.
  if (args.workspaceIds && !args.workspaceIds.includes(args.workspaceId)) {
    return null
  }

  // Special case: org_member with explicit single-workspace scope is the
  // agency client-owner pattern — read-only viewer.
  const isClientOwnerPattern =
    args.orgRole === 'org_member' &&
    args.workspaceIds !== null &&
    args.workspaceIds.length === 1 &&
    args.workspaceIds[0] === args.workspaceId &&
    args.workspaceRole === null
  if (isClientOwnerPattern) {
    return ROLES.VIEWER
  }

  const orgDerived = orgRoleToEffectiveRole(args.orgRole)
  return args.workspaceRole ? maxRole(orgDerived, args.workspaceRole) : orgDerived
}
