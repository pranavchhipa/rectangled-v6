/**
 * Phase 1 — Org-aware permission helper.
 *
 * Replaces (gradually, opt-in) the per-service `requireMembership` checks.
 * The 3-step contract:
 *
 *   1. Resolve the workspace's organizationId.
 *   2. Find the user's organization_members row (must exist + acceptedAt set).
 *   3. Compute the effective role from (orgRole, workspaceMemberRole,
 *      workspaceIds scope) and check the requested capability.
 *
 * Returns the org membership + workspace membership (if any) so callers
 * can use them downstream without re-querying.
 *
 * This file is intentionally NOT consumed by every existing service in
 * Phase 1. New procedures opt in. Phase 2 migrates the existing services
 * one router at a time.
 */
import { TRPCError } from '@trpc/server'
import { eq, and, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  workspaces,
  members,
  organizations,
  organizationMembers,
} from '@rectangled/db'
import {
  computeEffectiveRole,
  hasPermission,
  type OrgRole,
  type Role,
  type Permission,
} from '@rectangled/shared'

export type PermissionResult = {
  organization: typeof organizations.$inferSelect
  orgMember: typeof organizationMembers.$inferSelect
  workspaceMember: typeof members.$inferSelect | null
  effectiveRole: Role
}

/**
 * Single-call check + lookup. Throws TRPCError on failure with a precise
 * code so callers don't need to rewrap.
 *
 * Usage:
 *   const access = await requireOrgWorkspaceAccess(db, ctx.user.sub, workspaceId, 'review:respond')
 *   // access.effectiveRole, access.organization, access.orgMember are all available
 */
export async function requireOrgWorkspaceAccess(
  db: Database,
  userId: string,
  workspaceId: string,
  capability?: Permission,
): Promise<PermissionResult> {
  // 1. Find the workspace + its org.
  const [ws] = await db
    .select({
      id: workspaces.id,
      organizationId: workspaces.organizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!ws) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' })
  }

  // 2. Find the user's org membership (must be accepted).
  const [orgMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, ws.organizationId),
        eq(organizationMembers.userId, userId),
        isNotNull(organizationMembers.acceptedAt),
      ),
    )
    .limit(1)

  if (!orgMember) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this organization',
    })
  }

  // 3. Find the (optional) workspace-level membership.
  const [wsMember] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt),
      ),
    )
    .limit(1)

  // 4. Compute effective role.
  const effectiveRole = computeEffectiveRole({
    orgRole: orgMember.role as OrgRole,
    workspaceRole: (wsMember?.role as Role) ?? null,
    workspaceIds: orgMember.workspaceIds ?? null,
    workspaceId,
  })

  if (!effectiveRole) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Workspace not in your assigned scope',
    })
  }

  // 5. Capability check (if requested).
  if (capability && !hasPermission(effectiveRole, capability)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing capability: ${capability}`,
    })
  }

  // Load full org row for the caller's convenience.
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, ws.organizationId))
    .limit(1)

  return {
    organization: organization!,
    orgMember,
    workspaceMember: wsMember ?? null,
    effectiveRole,
  }
}

/**
 * Lighter-weight variant: just check org membership without picking a
 * specific workspace. Used for org-level routes (org settings, white-label,
 * member management).
 */
export async function requireOrgAccess(
  db: Database,
  userId: string,
  organizationId: string,
  options?: { roles?: OrgRole[] },
): Promise<{
  organization: typeof organizations.$inferSelect
  orgMember: typeof organizationMembers.$inferSelect
}> {
  const [orgMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        isNotNull(organizationMembers.acceptedAt),
      ),
    )
    .limit(1)

  if (!orgMember) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not an organization member' })
  }

  if (options?.roles && !options.roles.includes(orgMember.role as OrgRole)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Insufficient organization role`,
    })
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!organization) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' })
  }

  return { organization, orgMember }
}
