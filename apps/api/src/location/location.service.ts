import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { locations, members } from '@rectangled/db'
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
