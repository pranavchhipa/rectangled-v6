import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import { truforms, truformResponses, members } from '@rectangled/db'

@Injectable()
export class TruformService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async list(workspaceId: string, locationId: string | undefined, userId: string) {
    await this.requireMembership(workspaceId, userId)
    const conditions = [eq(truforms.workspaceId, workspaceId)]
    if (locationId) conditions.push(eq(truforms.locationId, locationId))

    return this.db.query.truforms.findMany({
      where: and(...conditions),
      orderBy: [desc(truforms.createdAt)],
    })
  }

  async getById(id: string, userId: string) {
    const form = await this.findOrThrow(id)
    await this.requireMembership(form.workspaceId, userId)
    return form
  }

  async create(
    input: {
      workspaceId: string
      locationId?: string
      name: string
      type: string
      config?: { questions?: unknown[]; branding?: Record<string, unknown>; thankYouMessage?: string }
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)
    const slug = `f-${randomUUID().slice(0, 10)}`

    const [form] = await this.db
      .insert(truforms)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId,
        name: input.name.trim(),
        type: input.type as any,
        slug,
        config: {
          questions: (input.config?.questions as any[]) || [],
          branding: input.config?.branding || {},
          thankYouMessage: input.config?.thankYouMessage || 'Thank you for your feedback!',
        },
      })
      .returning()

    return form
  }

  async update(
    input: {
      id: string
      name?: string
      config?: { questions?: unknown[]; branding?: Record<string, unknown>; thankYouMessage?: string }
    },
    userId: string
  ) {
    const form = await this.findOrThrow(input.id)
    await this.requireMembership(form.workspaceId, userId)

    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) setValues.name = input.name.trim()
    if (input.config) {
      setValues.config = { ...form.config, ...input.config }
    }

    const [updated] = await this.db
      .update(truforms)
      .set(setValues)
      .where(eq(truforms.id, input.id))
      .returning()

    return updated
  }

  async delete(id: string, userId: string) {
    const form = await this.findOrThrow(id)
    await this.requireMembership(form.workspaceId, userId)
    await this.db.delete(truforms).where(eq(truforms.id, id))
    return { success: true }
  }

  async activate(id: string, userId: string) {
    const form = await this.findOrThrow(id)
    await this.requireMembership(form.workspaceId, userId)
    const [updated] = await this.db
      .update(truforms)
      .set({ status: 'active' as any, updatedAt: new Date() })
      .where(eq(truforms.id, id))
      .returning()
    return updated
  }

  async archive(id: string, userId: string) {
    const form = await this.findOrThrow(id)
    await this.requireMembership(form.workspaceId, userId)
    const [updated] = await this.db
      .update(truforms)
      .set({ status: 'archived' as any, updatedAt: new Date() })
      .where(eq(truforms.id, id))
      .returning()
    return updated
  }

  // PUBLIC
  async getPublic(slug: string) {
    const form = await this.db.query.truforms.findFirst({
      where: and(eq(truforms.slug, slug), eq(truforms.status, 'active' as any)),
    })
    if (!form) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' })
    }
    return { id: form.id, name: form.name, type: form.type, config: form.config }
  }

  // PUBLIC
  async submitResponse(input: {
    truformId: string
    score?: number
    answers: Record<string, unknown>
    metadata: Record<string, unknown>
  }) {
    const [response] = await this.db
      .insert(truformResponses)
      .values({
        truformId: input.truformId,
        score: input.score,
        answers: input.answers,
        metadata: input.metadata,
        completedAt: new Date(),
      })
      .returning()
    return { success: true, responseId: response.id }
  }

  async getResponses(truformId: string, page: number, limit: number, userId: string) {
    const form = await this.findOrThrow(truformId)
    await this.requireMembership(form.workspaceId, userId)

    const offset = (page - 1) * limit
    const responses = await this.db.query.truformResponses.findMany({
      where: eq(truformResponses.truformId, truformId),
      orderBy: [desc(truformResponses.createdAt)],
      limit,
      offset,
    })

    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(truformResponses)
      .where(eq(truformResponses.truformId, truformId))

    return { responses, total: Number(total), page, limit }
  }

  async getStats(truformId: string, userId: string) {
    const form = await this.findOrThrow(truformId)
    await this.requireMembership(form.workspaceId, userId)

    const responses = await this.db.query.truformResponses.findMany({
      where: eq(truformResponses.truformId, truformId),
    })

    const totalResponses = responses.length
    const scores = responses.filter((r) => r.score !== null).map((r) => r.score!)

    if (form.type === 'nps') {
      const promoters = scores.filter((s) => s >= 9).length
      const detractors = scores.filter((s) => s <= 6).length
      const npsScore = totalResponses > 0
        ? Math.round(((promoters - detractors) / totalResponses) * 100)
        : 0
      return { type: 'nps', totalResponses, npsScore, promoters, passives: totalResponses - promoters - detractors, detractors }
    }

    if (form.type === 'csat') {
      const satisfied = scores.filter((s) => s >= 4).length
      const csatPercent = totalResponses > 0 ? Math.round((satisfied / totalResponses) * 100) : 0
      return { type: 'csat', totalResponses, csatPercent, avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 }
    }

    if (form.type === 'ces') {
      const avgEffort = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      return { type: 'ces', totalResponses, avgEffort }
    }

    return { type: 'custom', totalResponses }
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
    const form = await this.db.query.truforms.findFirst({
      where: eq(truforms.id, id),
    })
    if (!form) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'TruForm not found' })
    }
    return form
  }
}
