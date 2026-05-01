import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, count, isNotNull, or, like, sql } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { workspaces, members, locations, customers, reviews, couponTemplates, organizations, organizationMembers } from '@rectangled/db'
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '@rectangled/shared'
import { hasPermission } from '@rectangled/shared'
import type { Role } from '@rectangled/shared'

@Injectable()
export class WorkspaceService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * Create a new workspace and make the creator the owner.
   *
   * Phase 1 — every workspace lives under an organization. Direct mode
   * default: create a fresh `direct` organization for this workspace so
   * the legacy single-business UX continues to work. Phase 1 Stage C
   * adds `createInOrganization()` for multi-location and agency flows.
   */
  async create(input: CreateWorkspaceInput, userId: string) {
    // Check slug uniqueness
    const existing = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.slug, input.slug),
    })
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'A workspace with this slug already exists' })
    }

    // Create the direct-mode org first so the workspace's organizationId is set.
    const orgSlug = `${input.slug}-org`.slice(0, 100)
    const [organization] = await this.db
      .insert(organizations)
      .values({
        name: input.name.trim(),
        slug: orgSlug,
        type: 'direct',
        ownerUserId: userId,
      })
      .returning()

    const [workspace] = await this.db
      .insert(workspaces)
      .values({
        organizationId: organization.id,
        name: input.name.trim(),
        slug: input.slug,
        industry: input.industry,
        settings: {
          defaultTimezone: 'Asia/Kolkata',
          aiAutoRespond: false,
          reviewResponseDelay: { min: 1, max: 3 },
          frequencyCap: { maxSurveys: 2, windowDays: 60 },
          customerRateCap: {
            maxMessagesPerDay: 3,
            maxCouponsPerMonth: 1,
            maxActionsPerWeek: 10,
          },
        },
      })
      .returning()

    // Workspace-level membership (legacy).
    await this.db.insert(members).values({
      userId,
      workspaceId: workspace.id,
      role: 'owner',
      acceptedAt: new Date(),
    })

    // Org-level membership (Phase 1 layer).
    await this.db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId,
      role: 'org_owner',
      acceptedAt: new Date(),
    })

    return workspace
  }

  /**
   * List all workspaces the user is an accepted member of, with location counts.
   */
  async list(userId: string) {
    // Find all workspaces where the user is an accepted member
    const userMembers = await this.db
      .select({
        workspaceId: members.workspaceId,
        role: members.role,
      })
      .from(members)
      .where(and(eq(members.userId, userId), isNotNull(members.acceptedAt)))

    if (userMembers.length === 0) {
      return []
    }

    const result = await Promise.all(
      userMembers.map(async (m) => {
        const workspace = await this.db.query.workspaces.findFirst({
          where: eq(workspaces.id, m.workspaceId),
        })

        if (!workspace) return null

        const [locationCount] = await this.db
          .select({ count: count() })
          .from(locations)
          .where(eq(locations.workspaceId, m.workspaceId))

        return {
          ...workspace,
          role: m.role,
          locationCount: locationCount.count,
        }
      }),
    )

    return result.filter(Boolean)
  }

  /**
   * Get a workspace by ID. Requires the user to be a member.
   */
  async getById(id: string, userId: string) {
    await this.requireMembership(id, userId)

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    })

    if (!workspace) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' })
    }

    const workspaceLocations = await this.db.query.locations.findMany({
      where: eq(locations.workspaceId, id),
    })

    return {
      ...workspace,
      locations: workspaceLocations,
    }
  }

  /**
   * Update a workspace. Requires workspace:update permission.
   */
  async update(input: UpdateWorkspaceInput, userId: string) {
    const membership = await this.requireMembership(input.id, userId)

    if (!hasPermission(membership.role as Role, 'workspace:update')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update this workspace',
      })
    }

    const { id, ...updateData } = input

    // Build the update fields, only including provided values
    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    if (updateData.name !== undefined) updateFields.name = updateData.name.trim()
    if (updateData.industry !== undefined) updateFields.industry = updateData.industry
    if (updateData.brandColors !== undefined) updateFields.brandColors = updateData.brandColors
    if (updateData.tonePreset !== undefined) updateFields.tonePreset = updateData.tonePreset
    if (updateData.settings !== undefined) {
      // Merge with existing settings
      const existing = await this.db.query.workspaces.findFirst({
        where: eq(workspaces.id, id),
      })
      if (existing) {
        updateFields.settings = { ...existing.settings, ...updateData.settings }
      }
    }

    const [updated] = await this.db
      .update(workspaces)
      .set(updateFields)
      .where(eq(workspaces.id, id))
      .returning()

    return updated
  }

  /**
   * Delete a workspace. Requires workspace:delete permission.
   */
  async delete(id: string, userId: string) {
    const membership = await this.requireMembership(id, userId)

    if (!hasPermission(membership.role as Role, 'workspace:delete')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this workspace',
      })
    }

    await this.db.delete(workspaces).where(eq(workspaces.id, id))

    return { success: true }
  }

  /**
   * Global search across workspace data — customers, reviews, locations, coupons.
   */
  async globalSearch(workspaceId: string, query: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const searchTerm = `%${query}%`
    const limit = 5

    const [locationResults, customerResults, reviewResults, couponResults] = await Promise.all([
      this.db
        .select({ id: locations.id, name: locations.name, city: locations.city })
        .from(locations)
        .where(and(
          eq(locations.workspaceId, workspaceId),
          or(like(locations.name, searchTerm), like(locations.city, searchTerm))
        ))
        .limit(limit),

      this.db
        .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
        .from(customers)
        .where(and(
          eq(customers.workspaceId, workspaceId),
          or(
            like(customers.name, searchTerm),
            like(customers.email, searchTerm),
            like(customers.phone, searchTerm)
          )
        ))
        .limit(limit),

      this.db
        .select({ id: reviews.id, reviewerName: reviews.reviewerName, text: reviews.text, platform: reviews.platform })
        .from(reviews)
        .where(and(
          eq(reviews.workspaceId, workspaceId),
          or(
            like(reviews.reviewerName, searchTerm),
            like(reviews.text, searchTerm)
          )
        ))
        .limit(limit),

      this.db
        .select({ id: couponTemplates.id, name: couponTemplates.name, codePrefix: couponTemplates.codePrefix })
        .from(couponTemplates)
        .where(and(
          eq(couponTemplates.workspaceId, workspaceId),
          or(
            like(couponTemplates.name, searchTerm),
            like(couponTemplates.codePrefix, searchTerm)
          )
        ))
        .limit(limit),
    ])

    return {
      locations: locationResults,
      customers: customerResults,
      reviews: reviewResults,
      coupons: couponResults,
    }
  }

  /**
   * Check that the user is an accepted member of the workspace.
   * Returns the membership record if found, throws otherwise.
   */
  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt),
      ),
    })

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return membership
  }
}
