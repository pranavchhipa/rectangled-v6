import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, isNotNull, sql, desc } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  organizations,
  organizationMembers,
  workspaces,
} from '@rectangled/db'
import type { OrgRole } from '@rectangled/shared'
import { requireOrgAccess } from '../auth/permissions'

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name)
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * List all organizations the calling user is an accepted member of.
   * Returns each org with derived counts (workspace count, member count)
   * for the dashboard switcher.
   */
  async list(userId: string) {
    const memberships = await this.db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          isNotNull(organizationMembers.acceptedAt),
        ),
      )

    if (memberships.length === 0) return []

    const orgIds = memberships.map((m) => m.organizationId)
    const orgRows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        type: organizations.type,
        ownerUserId: organizations.ownerUserId,
        settings: organizations.settings,
        whiteLabel: organizations.whiteLabel,
        status: organizations.status,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(sql`${organizations.id} = ANY(${orgIds})`)
      .orderBy(desc(organizations.createdAt))

    // Counts per org
    const wsCounts = await this.db
      .select({
        organizationId: workspaces.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaces)
      .where(sql`${workspaces.organizationId} = ANY(${orgIds})`)
      .groupBy(workspaces.organizationId)

    const memberCounts = await this.db
      .select({
        organizationId: organizationMembers.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(organizationMembers)
      .where(
        and(
          sql`${organizationMembers.organizationId} = ANY(${orgIds})`,
          isNotNull(organizationMembers.acceptedAt),
        ),
      )
      .groupBy(organizationMembers.organizationId)

    const wsCountMap = new Map(wsCounts.map((c) => [c.organizationId, c.count]))
    const memberCountMap = new Map(memberCounts.map((c) => [c.organizationId, c.count]))
    const roleMap = new Map(memberships.map((m) => [m.organizationId, m.role]))

    return orgRows.map((o) => ({
      ...o,
      myRole: roleMap.get(o.id) as OrgRole,
      workspaceCount: wsCountMap.get(o.id) ?? 0,
      memberCount: memberCountMap.get(o.id) ?? 0,
    }))
  }

  async getById(organizationId: string, userId: string) {
    const { organization, orgMember } = await requireOrgAccess(this.db, userId, organizationId)
    const [{ wsCount, memberCount }] = await this.db
      .select({
        wsCount: sql<number>`(select count(*)::int from ${workspaces} where ${workspaces.organizationId} = ${organizationId})`,
        memberCount: sql<number>`(select count(*)::int from ${organizationMembers} where ${organizationMembers.organizationId} = ${organizationId} and ${organizationMembers.acceptedAt} is not null)`,
      })
      .from(sql`(select 1) AS dummy`)
    return {
      ...organization,
      myRole: orgMember.role as OrgRole,
      workspaceCount: wsCount,
      memberCount,
    }
  }

  /**
   * Standalone org creation (no workspace). Used when an existing user
   * upgrades from direct → multi_location/agency and wants to start fresh,
   * OR when an agency wants to spin up a new client portfolio.
   *
   * The caller becomes the org_owner. They can later add workspaces via
   * `workspace.createInOrganization` (Stage F+).
   */
  async create(input: { name: string; type: 'direct' | 'multi_location' | 'agency' }, userId: string) {
    // Generate a unique slug — lowercase + random suffix.
    const baseSlug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90)
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

    const [organization] = await this.db
      .insert(organizations)
      .values({
        name: input.name.trim(),
        slug,
        type: input.type,
        ownerUserId: userId,
      })
      .returning()

    await this.db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId,
      role: 'org_owner',
      acceptedAt: new Date(),
    })

    this.logger.log(`Created organization ${organization.id} (${input.type}) for user ${userId}`)
    return organization
  }

  async update(
    input: {
      organizationId: string
      name?: string
      settings?: Record<string, unknown>
      whiteLabel?: Record<string, unknown>
    },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId, {
      roles: ['org_owner', 'org_admin'],
    })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) updates.name = input.name.trim()
    if (input.settings !== undefined) updates.settings = input.settings
    if (input.whiteLabel !== undefined) updates.whiteLabel = input.whiteLabel

    const [updated] = await this.db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, input.organizationId))
      .returning()
    return updated
  }

  /**
   * Upgrade or downgrade an org's type.
   *
   * Allowed: direct → multi_location → agency (and any pair combination
   * conceptually, since it's the same data model just different UX).
   *
   * Refuses to downgrade to 'direct' if the org has more than one workspace
   * — that would orphan UX behaviours.
   */
  async updateType(
    input: { organizationId: string; type: 'direct' | 'multi_location' | 'agency' },
    userId: string,
  ) {
    await requireOrgAccess(this.db, userId, input.organizationId, {
      roles: ['org_owner'],
    })

    if (input.type === 'direct') {
      const [{ wsCount }] = await this.db
        .select({ wsCount: sql<number>`count(*)::int` })
        .from(workspaces)
        .where(eq(workspaces.organizationId, input.organizationId))
      if (wsCount > 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot downgrade to 'direct': org has ${wsCount} workspaces. Direct mode supports only one.`,
        })
      }
    }

    const [updated] = await this.db
      .update(organizations)
      .set({ type: input.type, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning()
    return updated
  }

  async delete(organizationId: string, userId: string) {
    await requireOrgAccess(this.db, userId, organizationId, { roles: ['org_owner'] })
    await this.db.delete(organizations).where(eq(organizations.id, organizationId))
    return { success: true as const }
  }

  /**
   * Public lookup by org slug. Used by white-labeled login pages and
   * public pages to theme themselves. Returns only the white-label
   * config — no internal data leaks.
   */
  async getWhiteLabelBySlug(slug: string) {
    const [row] = await this.db
      .select({
        whiteLabel: organizations.whiteLabel,
        name: organizations.name,
        type: organizations.type,
      })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1)
    if (!row) return null
    return {
      name: row.name,
      type: row.type,
      whiteLabel: row.whiteLabel,
    }
  }
}
