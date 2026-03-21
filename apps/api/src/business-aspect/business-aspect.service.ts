import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, asc } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { businessAspects, members } from '@rectangled/db'
import { DEFAULT_BUSINESS_ASPECTS } from '@rectangled/shared'

@Injectable()
export class BusinessAspectService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async list(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    return this.db.query.businessAspects.findMany({
      where: eq(businessAspects.workspaceId, workspaceId),
      orderBy: [asc(businessAspects.sortOrder)],
    })
  }

  async seedDefaults(workspaceId: string, industry: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    // Check if aspects already exist
    const existing = await this.db.query.businessAspects.findFirst({
      where: eq(businessAspects.workspaceId, workspaceId),
    })
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Business aspects already exist for this workspace',
      })
    }

    const defaults = DEFAULT_BUSINESS_ASPECTS[industry as keyof typeof DEFAULT_BUSINESS_ASPECTS]
      || DEFAULT_BUSINESS_ASPECTS['other']

    const values = defaults.map((name, index) => ({
      workspaceId,
      name,
      isDefault: true,
      isActive: true,
      sortOrder: index,
    }))

    const inserted = await this.db.insert(businessAspects).values(values).returning()
    return inserted
  }

  async create(input: { workspaceId: string; name: string; category?: string }, userId: string) {
    await this.requireMembership(input.workspaceId, userId)

    // Get max sort order
    const existing = await this.db.query.businessAspects.findMany({
      where: eq(businessAspects.workspaceId, input.workspaceId),
      orderBy: [asc(businessAspects.sortOrder)],
    })
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((a) => a.sortOrder)) : -1

    const [aspect] = await this.db
      .insert(businessAspects)
      .values({
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        category: input.category,
        isDefault: false,
        sortOrder: maxOrder + 1,
      })
      .returning()

    return aspect
  }

  async update(
    input: { id: string; name?: string; category?: string; isActive?: boolean; sortOrder?: number },
    userId: string
  ) {
    const aspect = await this.findOrThrow(input.id)
    await this.requireMembership(aspect.workspaceId, userId)

    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) setValues.name = input.name.trim()
    if (input.category !== undefined) setValues.category = input.category
    if (input.isActive !== undefined) setValues.isActive = input.isActive
    if (input.sortOrder !== undefined) setValues.sortOrder = input.sortOrder

    const [updated] = await this.db
      .update(businessAspects)
      .set(setValues)
      .where(eq(businessAspects.id, input.id))
      .returning()

    return updated
  }

  async delete(id: string, userId: string) {
    const aspect = await this.findOrThrow(id)
    await this.requireMembership(aspect.workspaceId, userId)
    await this.db.delete(businessAspects).where(eq(businessAspects.id, id))
    return { success: true }
  }

  async reorder(workspaceId: string, orderedIds: string[], userId: string) {
    await this.requireMembership(workspaceId, userId)

    for (let i = 0; i < orderedIds.length; i++) {
      await this.db
        .update(businessAspects)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(businessAspects.id, orderedIds[i]), eq(businessAspects.workspaceId, workspaceId)))
    }

    return { success: true }
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace' })
    }
    return membership
  }

  private async findOrThrow(id: string) {
    const aspect = await this.db.query.businessAspects.findFirst({
      where: eq(businessAspects.id, id),
    })
    if (!aspect) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Business aspect not found' })
    }
    return aspect
  }
}
