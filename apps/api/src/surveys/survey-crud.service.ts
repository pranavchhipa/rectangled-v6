import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, isNull, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import { surveys, members, workspaces } from '@rectangled/db'
import {
  buildQuickIntelligentSteps,
  buildDeepIntelligentSteps,
  DEFAULT_JOURNEY_SETTINGS_V2,
  type SurveyStep,
} from '@rectangled/shared'

/**
 * Phase 3 Stage D — Survey CRUD service.
 *
 * Owns list / getById / create / update / archive for the unified
 * `surveys` table. Engine endpoints (getInitialState / advance / complete)
 * live in `survey-engine.service.ts`.
 *
 * Defaults applied at create time:
 *   - mode='intelligent' (server-seeded steps)
 *   - status='draft'
 *   - quick template → DEFAULT_JOURNEY_SETTINGS_V2 + buildQuickIntelligentSteps
 *   - deep template  → settings.type defaults to 'csat' if not provided,
 *                      steps from buildDeepIntelligentSteps(type)
 */
@Injectable()
export class SurveyCrudService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async list(
    workspaceId: string,
    filters: {
      locationId?: string
      template?: 'quick' | 'deep'
      status?: 'draft' | 'active' | 'archived'
      includeArchived?: boolean
    },
    userId: string,
  ) {
    await this.requireMembership(workspaceId, userId)
    const conditions = [eq(surveys.workspaceId, workspaceId)]
    if (filters.locationId) conditions.push(eq(surveys.locationId, filters.locationId))
    if (filters.template) conditions.push(eq(surveys.template, filters.template))
    if (filters.status) conditions.push(eq(surveys.status, filters.status))
    if (!filters.includeArchived) conditions.push(isNull(surveys.archivedAt))

    return this.db.query.surveys.findMany({
      where: and(...conditions),
      orderBy: [desc(surveys.createdAt)],
    })
  }

  async getById(id: string, userId: string) {
    const survey = await this.findOrThrow(id)
    await this.requireMembership(survey.workspaceId, userId)
    return survey
  }

  async create(
    input: {
      workspaceId: string
      locationId?: string
      name: string
      template: 'quick' | 'deep'
      mode?: 'intelligent' | 'builder'
      settings?: Record<string, unknown>
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Workspace → organization lookup. The surveys table requires
    // organization_id (NOT NULL) so we resolve it from the workspace
    // here rather than asking the caller.
    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, input.workspaceId),
    })
    if (!workspace) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' })
    }

    const slugPrefix = input.template === 'quick' ? 'j' : 'f'
    const slug = `${slugPrefix}-${randomUUID().slice(0, 10)}`

    const incomingSettings = input.settings ?? {}
    let settings: Record<string, unknown>
    let steps: SurveyStep[]

    if (input.template === 'quick') {
      // Merge journey-v2 defaults; respect any per-metric thresholds the
      // caller provided so partial settings work.
      const incomingThresholds =
        (incomingSettings as { thresholds?: Record<string, number> }).thresholds ?? {}
      settings = {
        ...DEFAULT_JOURNEY_SETTINGS_V2,
        ...incomingSettings,
        thresholds: {
          ...DEFAULT_JOURNEY_SETTINGS_V2.thresholds,
          ...incomingThresholds,
        },
      }
      steps = buildQuickIntelligentSteps({
        enabledMetrics: (settings as { enabledMetrics?: any }).enabledMetrics,
        reviewPlatform: (settings as { reviewPlatform?: any }).reviewPlatform,
      })
    } else {
      const type =
        ((incomingSettings as { type?: string }).type as
          | 'nps'
          | 'csat'
          | 'ces'
          | 'custom') ?? 'csat'
      settings = {
        type,
        thankYouMessage: 'Thanks for your feedback!',
        ...incomingSettings,
      }
      steps = buildDeepIntelligentSteps(type, {
        thankYouMessage: (settings as { thankYouMessage?: string }).thankYouMessage,
      })
    }

    const [survey] = await this.db
      .insert(surveys)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId ?? null,
        organizationId: workspace.organizationId,
        name: input.name.trim(),
        slug,
        template: input.template,
        mode: input.mode ?? 'intelligent',
        status: 'draft',
        settings,
        steps,
      })
      .returning()

    return survey
  }

  async update(
    input: {
      id: string
      name?: string
      locationId?: string | null
      status?: 'draft' | 'active' | 'archived'
      mode?: 'intelligent' | 'builder'
      settings?: Record<string, unknown>
      steps?: unknown[]
    },
    userId: string,
  ) {
    const survey = await this.findOrThrow(input.id)
    await this.requireMembership(survey.workspaceId, userId)

    const patch: Partial<typeof surveys.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.locationId !== undefined) patch.locationId = input.locationId
    if (input.status !== undefined) {
      patch.status = input.status
      // Archiving via update should also stamp archivedAt.
      if (input.status === 'archived' && !survey.archivedAt) {
        patch.archivedAt = new Date()
      }
      if (input.status !== 'archived' && survey.archivedAt) {
        patch.archivedAt = null
      }
    }
    if (input.mode !== undefined) patch.mode = input.mode
    if (input.settings !== undefined) {
      // Shallow merge so callers can patch sub-fields without resending
      // the whole settings object.
      patch.settings = {
        ...(survey.settings as Record<string, unknown>),
        ...input.settings,
      }
    }
    if (input.steps !== undefined) patch.steps = input.steps as unknown[]

    const [updated] = await this.db
      .update(surveys)
      .set(patch)
      .where(eq(surveys.id, input.id))
      .returning()

    return updated
  }

  async archive(id: string, userId: string) {
    const survey = await this.findOrThrow(id)
    await this.requireMembership(survey.workspaceId, userId)
    if (survey.archivedAt) return survey

    const [archived] = await this.db
      .update(surveys)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(surveys.id, id))
      .returning()

    return archived
  }

  // ─── private helpers ────────────────────────────────────────────────────

  private async findOrThrow(id: string) {
    const survey = await this.db.query.surveys.findFirst({
      where: eq(surveys.id, id),
    })
    if (!survey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' })
    }
    return survey
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
}
