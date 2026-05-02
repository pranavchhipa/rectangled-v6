import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, isNull, inArray, gte, lte, or, ilike, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import {
  surveys,
  members,
  workspaces,
  surveyResponses,
  customers,
  locations,
} from '@rectangled/db'
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
      template?: 'quick' | 'deep' | 'adaptive' | 'custom'
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
      template: 'quick' | 'deep' | 'adaptive' | 'custom'
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

    // Hotfix §2 — adaptive surveys reuse the /j/ slug space (same QR
    // namespace as quick journeys), deep surveys use /f/.
    const slugPrefix =
      input.template === 'deep' ? 'f' : 'j'
    const slug = `${slugPrefix}-${randomUUID().slice(0, 10)}`

    const incomingSettings = input.settings ?? {}
    let settings: Record<string, unknown>
    let steps: SurveyStep[]

    if (input.template === 'quick' || input.template === 'adaptive') {
      // Merge journey-v2 defaults; respect any per-metric thresholds the
      // caller provided so partial settings work. Adaptive shares the
      // same settings shape — engines diverge but settings are the same.
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
      // Step graph stays populated even for adaptive — it's the rollback
      // safety net. The adaptive engine reads settings, not steps, but
      // if we ever flip a survey back to template='quick' the step engine
      // needs a working graph.
      steps = buildQuickIntelligentSteps({
        enabledMetrics: (settings as { enabledMetrics?: any }).enabledMetrics,
        reviewPlatform: (settings as { reviewPlatform?: any }).reviewPlatform,
      })
    } else if (input.template === 'custom') {
      // Hotfix §3 wizard surfaces will populate this. For now: no defaults,
      // empty settings + empty steps — the wizard fills both.
      settings = { ...incomingSettings }
      steps = []
    } else {
      // deep
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

  // ─── Hotfix PRD §6 — Responses listing + detail ─────────────────────

  /**
   * List survey responses with filters. Either workspaceId
   * (workspace-wide) or surveyId (per-survey) must be set. If both,
   * surveyId scopes the result and workspace is the membership guard.
   *
   * Supports:
   *   - filter: 'all' | 'happy' | 'unhappy' | 'neutral' (NULL is_positive)
   *   - search: case-insensitive match on customer name/email/phone
   *   - dateFrom / dateTo: range on survey_responses.created_at
   *   - page + limit pagination
   */
  async listResponses(
    input: {
      workspaceId?: string
      surveyId?: string
      filter?: 'all' | 'happy' | 'unhappy' | 'neutral'
      search?: string
      dateFrom?: string | Date
      dateTo?: string | Date
      page: number
      limit: number
    },
    userId: string,
  ) {
    if (!input.workspaceId && !input.surveyId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Either workspaceId or surveyId is required.',
      })
    }

    // Resolve workspace id from survey if only surveyId provided.
    let workspaceId = input.workspaceId
    let survey: typeof surveys.$inferSelect | null = null
    if (input.surveyId) {
      survey = (await this.findOrThrow(input.surveyId)) as any
      if (!workspaceId) workspaceId = survey!.workspaceId
      if (workspaceId && workspaceId !== survey!.workspaceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'workspaceId does not match the survey.',
        })
      }
    }

    await this.requireMembership(workspaceId!, userId)

    const conditions = [eq(surveyResponses.workspaceId, workspaceId!)]
    if (input.surveyId) {
      conditions.push(eq(surveyResponses.surveyId, input.surveyId))
    }
    if (input.filter === 'happy')
      conditions.push(eq(surveyResponses.isPositive, true))
    if (input.filter === 'unhappy')
      conditions.push(eq(surveyResponses.isPositive, false))
    if (input.filter === 'neutral')
      conditions.push(isNull(surveyResponses.isPositive))
    if (input.dateFrom) {
      const d = input.dateFrom instanceof Date ? input.dateFrom : new Date(input.dateFrom)
      conditions.push(gte(surveyResponses.createdAt, d))
    }
    if (input.dateTo) {
      const d = input.dateTo instanceof Date ? input.dateTo : new Date(input.dateTo)
      conditions.push(lte(surveyResponses.createdAt, d))
    }

    // Search applies to the joined customer fields. We left-join customers
    // and filter via a sub-OR (so responses with no linked customer can
    // still match if search isn't provided).
    const offset = (input.page - 1) * input.limit

    const baseWhere = and(...conditions)

    let rows: Array<{
      id: string
      surveyId: string
      surveyName: string | null
      surveyTemplate: 'quick' | 'deep' | 'adaptive' | 'custom' | null
      customerId: string | null
      customerName: string | null
      customerEmail: string | null
      customerPhone: string | null
      locationId: string | null
      locationName: string | null
      metricShown: string | null
      metricScore: number | null
      isPositive: boolean | null
      score: number | null
      responseData: Record<string, unknown> | null
      answers: Record<string, unknown> | null
      sessionId: string
      completedAt: Date | null
      createdAt: Date
    }>
    let total: number

    if (input.search) {
      const term = `%${input.search}%`
      const searchClause = or(
        ilike(customers.name, term),
        ilike(customers.email, term),
        ilike(customers.phone, term),
      )
      const fullWhere = and(baseWhere, searchClause)

      const result = await this.db
        .select({
          id: surveyResponses.id,
          surveyId: surveyResponses.surveyId,
          surveyName: surveys.name,
          surveyTemplate: surveys.template,
          customerId: surveyResponses.customerId,
          customerName: customers.name,
          customerEmail: customers.email,
          customerPhone: customers.phone,
          locationId: surveyResponses.locationId,
          locationName: locations.name,
          metricShown: surveyResponses.metricShown,
          metricScore: surveyResponses.metricScore,
          isPositive: surveyResponses.isPositive,
          score: surveyResponses.score,
          responseData: surveyResponses.responseData,
          answers: surveyResponses.answers,
          sessionId: surveyResponses.sessionId,
          completedAt: surveyResponses.completedAt,
          createdAt: surveyResponses.createdAt,
        })
        .from(surveyResponses)
        .innerJoin(customers, eq(customers.id, surveyResponses.customerId))
        .leftJoin(surveys, eq(surveys.id, surveyResponses.surveyId))
        .leftJoin(locations, eq(locations.id, surveyResponses.locationId))
        .where(fullWhere)
        .orderBy(desc(surveyResponses.createdAt))
        .limit(input.limit)
        .offset(offset)

      rows = result as any

      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(surveyResponses)
        .innerJoin(customers, eq(customers.id, surveyResponses.customerId))
        .where(fullWhere)
      total = countResult[0]?.count ?? 0
    } else {
      const result = await this.db
        .select({
          id: surveyResponses.id,
          surveyId: surveyResponses.surveyId,
          surveyName: surveys.name,
          surveyTemplate: surveys.template,
          customerId: surveyResponses.customerId,
          customerName: customers.name,
          customerEmail: customers.email,
          customerPhone: customers.phone,
          locationId: surveyResponses.locationId,
          locationName: locations.name,
          metricShown: surveyResponses.metricShown,
          metricScore: surveyResponses.metricScore,
          isPositive: surveyResponses.isPositive,
          score: surveyResponses.score,
          responseData: surveyResponses.responseData,
          answers: surveyResponses.answers,
          sessionId: surveyResponses.sessionId,
          completedAt: surveyResponses.completedAt,
          createdAt: surveyResponses.createdAt,
        })
        .from(surveyResponses)
        .leftJoin(customers, eq(customers.id, surveyResponses.customerId))
        .leftJoin(surveys, eq(surveys.id, surveyResponses.surveyId))
        .leftJoin(locations, eq(locations.id, surveyResponses.locationId))
        .where(baseWhere)
        .orderBy(desc(surveyResponses.createdAt))
        .limit(input.limit)
        .offset(offset)

      rows = result as any

      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(surveyResponses)
        .where(baseWhere)
      total = countResult[0]?.count ?? 0
    }

    return { responses: rows, total, page: input.page, limit: input.limit }
  }

  /**
   * Full detail for one response. Includes parent survey, location,
   * and customer (if linked).
   */
  async getResponseById(id: string, userId: string) {
    const [row] = await this.db
      .select({
        response: surveyResponses,
        survey: surveys,
        customer: customers,
        location: locations,
      })
      .from(surveyResponses)
      .leftJoin(surveys, eq(surveys.id, surveyResponses.surveyId))
      .leftJoin(customers, eq(customers.id, surveyResponses.customerId))
      .leftJoin(locations, eq(locations.id, surveyResponses.locationId))
      .where(eq(surveyResponses.id, id))
      .limit(1)

    if (!row || !row.response) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Response not found' })
    }
    await this.requireMembership(row.response.workspaceId, userId)
    return row
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
