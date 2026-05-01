import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, inArray } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { locations, members, locationSlaTargets } from '@rectangled/db'
import { hasPermission, type Role, type CreateLocationInput, type UpdateLocationInput } from '@rectangled/shared'

@Injectable()
export class LocationService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async create(input: CreateLocationInput, userId: string) {
    const membership = await this.requireMembership(input.workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'location:create')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to create locations',
      })
    }

    const [location] = await this.db
      .insert(locations)
      .values({
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        phone: input.phone,
        email: input.email,
        timezone: input.timezone,
      })
      .returning()

    return location
  }

  async list(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    return this.db.query.locations.findMany({
      where: eq(locations.workspaceId, workspaceId),
      orderBy: (locations, { asc }) => [asc(locations.name)],
    })
  }

  async getById(id: string, userId: string) {
    const location = await this.findLocationOrThrow(id)
    await this.requireMembership(location.workspaceId, userId)
    return location
  }

  async update(input: UpdateLocationInput, userId: string) {
    const location = await this.findLocationOrThrow(input.id)
    const membership = await this.requireMembership(location.workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'location:update')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update locations',
      })
    }

    const { id, ...updateData } = input

    // Build the set object, only including defined fields
    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (updateData.name !== undefined) setValues.name = updateData.name.trim()
    if (updateData.address !== undefined) setValues.address = updateData.address
    if (updateData.city !== undefined) setValues.city = updateData.city
    if (updateData.state !== undefined) setValues.state = updateData.state
    if (updateData.country !== undefined) setValues.country = updateData.country
    if (updateData.phone !== undefined) setValues.phone = updateData.phone
    if (updateData.email !== undefined) setValues.email = updateData.email
    if (updateData.timezone !== undefined) setValues.timezone = updateData.timezone

    const [updated] = await this.db
      .update(locations)
      .set(setValues)
      .where(eq(locations.id, id))
      .returning()

    return updated
  }

  async delete(id: string, userId: string) {
    const location = await this.findLocationOrThrow(id)
    const membership = await this.requireMembership(location.workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'location:delete')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete locations',
      })
    }

    await this.db.delete(locations).where(eq(locations.id, id))

    return { success: true }
  }

  async toggleActive(id: string, userId: string) {
    const location = await this.findLocationOrThrow(id)
    const membership = await this.requireMembership(location.workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'location:update')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update locations',
      })
    }

    const [updated] = await this.db
      .update(locations)
      .set({
        isActive: !location.isActive,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, id))
      .returning()

    return updated
  }

  // ─── Phase 2 Stage F: bulk operations + SLA targets ─────────

  /**
   * Apply a partial patch to N locations in a single round-trip per
   * location. Each location must be in a workspace the caller is a member
   * of (membership is verified per location to enforce the workspace
   * boundary).
   */
  async bulkUpdate(
    input: {
      ids: string[]
      patch: Partial<Pick<UpdateLocationInput, 'name' | 'address' | 'city' | 'state' | 'country' | 'phone' | 'email' | 'timezone' | 'ownerName'>> & {
        isActive?: boolean
      }
    },
    userId: string,
  ) {
    if (input.ids.length === 0) return { updated: 0 }
    if (input.ids.length > 100) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Max 100 IDs per bulk call' })
    }

    // Load to verify membership in each workspace.
    const targets = await this.db
      .select({ id: locations.id, workspaceId: locations.workspaceId })
      .from(locations)
      .where(inArray(locations.id, input.ids))
    if (targets.length !== input.ids.length) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Some locations not found' })
    }
    const distinctWs = [...new Set(targets.map((t) => t.workspaceId))]
    for (const wsId of distinctWs) {
      const membership = await this.requireMembership(wsId, userId)
      if (!hasPermission(membership.role as Role, 'location:update')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update locations in one of these workspaces',
        })
      }
    }

    const setValues: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input.patch)) {
      if (v !== undefined) setValues[k] = v
    }
    if (Object.keys(setValues).length === 0) return { updated: 0 }

    const updated = await this.db
      .update(locations)
      .set(setValues)
      .where(inArray(locations.id, input.ids))
      .returning({ id: locations.id })
    return { updated: updated.length }
  }

  /**
   * Per-location aspirational targets used by the chain dashboard.
   * Upserts: existing rows are updated in-place; new rows are inserted.
   */
  async setSlaTarget(
    input: {
      locationId: string
      reviewResponseSlaMinutes?: number | null
      escalationResolveSlaMinutes?: number | null
      journeyResponseTargetPerWeek?: number | null
      npsTargetScore?: number | null
      csatTargetPercent?: number | null
    },
    userId: string,
  ) {
    const location = await this.findLocationOrThrow(input.locationId)
    const membership = await this.requireMembership(location.workspaceId, userId)
    if (!hasPermission(membership.role as Role, 'location:update')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update SLA targets for this location',
      })
    }

    const values = {
      locationId: input.locationId,
      reviewResponseSlaMinutes: input.reviewResponseSlaMinutes ?? null,
      escalationResolveSlaMinutes: input.escalationResolveSlaMinutes ?? null,
      journeyResponseTargetPerWeek: input.journeyResponseTargetPerWeek ?? null,
      npsTargetScore: input.npsTargetScore ?? null,
      csatTargetPercent: input.csatTargetPercent ?? null,
      updatedAt: new Date(),
    }

    const [row] = await this.db
      .insert(locationSlaTargets)
      .values(values)
      .onConflictDoUpdate({
        target: locationSlaTargets.locationId,
        set: {
          reviewResponseSlaMinutes: values.reviewResponseSlaMinutes,
          escalationResolveSlaMinutes: values.escalationResolveSlaMinutes,
          journeyResponseTargetPerWeek: values.journeyResponseTargetPerWeek,
          npsTargetScore: values.npsTargetScore,
          csatTargetPercent: values.csatTargetPercent,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row
  }

  /**
   * Apply the same SLA target to N locations.
   */
  async bulkSetSlaTarget(
    input: {
      locationIds: string[]
      target: {
        reviewResponseSlaMinutes?: number | null
        escalationResolveSlaMinutes?: number | null
        journeyResponseTargetPerWeek?: number | null
        npsTargetScore?: number | null
        csatTargetPercent?: number | null
      }
    },
    userId: string,
  ) {
    if (input.locationIds.length === 0) return { updated: 0 }
    if (input.locationIds.length > 100) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Max 100 IDs per bulk call' })
    }

    let updated = 0
    for (const locId of input.locationIds) {
      await this.setSlaTarget({ locationId: locId, ...input.target }, userId)
      updated++
    }
    return { updated }
  }

  /**
   * Read the SLA target for one location. Returns null if not set.
   */
  async getSlaTarget(locationId: string, userId: string) {
    const location = await this.findLocationOrThrow(locationId)
    await this.requireMembership(location.workspaceId, userId)
    const [row] = await this.db
      .select()
      .from(locationSlaTargets)
      .where(eq(locationSlaTargets.locationId, locationId))
      .limit(1)
    return row ?? null
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })

    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return membership
  }

  private async findLocationOrThrow(id: string) {
    const location = await this.db.query.locations.findFirst({
      where: eq(locations.id, id),
    })

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      })
    }

    return location
  }
}
