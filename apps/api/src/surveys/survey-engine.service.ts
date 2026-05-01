import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import {
  surveys,
  surveyResponses,
  surveyStarts,
  workspaces,
  locations,
  customers,
} from '@rectangled/db'
import {
  type SurveyStep,
  type SurveyMetric,
  type AskMetricStep,
  type BranchByScoreStep,
  type BranchByAnswerStep,
  type CollectContactStep,
  type RedirectStep,
  type EndJourneyStep,
  isAskMetric,
  isBranchByScore,
  isBranchByAnswer,
  isEndJourney,
  isAskQuestion,
  isShowMessage,
  isCollectContact,
  isRedirect,
  pickNextStepIdByScore,
  pickNextStepIdByAnswer,
  isPositive as isPositiveScore,
  isScoreInRange,
  pickRandomMetric,
  METRIC_DEFAULT_THRESHOLDS,
} from '@rectangled/shared'

/**
 * Phase 3 — survey engine.
 *
 * Walks the step graph stored in `surveys.steps`. The engine is stateless
 * per-call: each request carries the current step id + the previous answer.
 * The engine validates, computes the next step, and returns it.
 *
 * State that DOES persist:
 *   - `survey_starts` row created on first visit (abandonment tracking).
 *   - `survey_responses` row inserted at completion. Quick-template metric
 *     score is also mirrored into the hot-path columns for analytics.
 *
 * Random metric selection: when an AskMetricStep has metric='random', the
 * engine picks one uniformly from `enabledMetricsForRandom` (default: all 5).
 *
 * Threshold resolution for branch_by_score: when a branch condition.value
 * is the literal 'threshold', the engine resolves it from
 * `survey.settings.thresholds[metricShown]` (quick template) or
 * `METRIC_DEFAULT_THRESHOLDS[metric]` as a fallback.
 */
@Injectable()
export class SurveyEngineService {
  private readonly logger = new Logger(SurveyEngineService.name)
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * Public entry point — first visit. Returns the resolved first step
   * (with any random-metric pick already made) plus the session id.
   */
  async getInitialState(input: {
    slug: string
    sessionId?: string
  }): Promise<InitialStateResponse> {
    const survey = await this.findActiveSurveyBySlug(input.slug)
    const steps = (survey.steps as SurveyStep[]) ?? []
    if (steps.length === 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Survey has no steps configured',
      })
    }

    // First step is steps[0] by convention. The builder enforces that
    // step[0] is always the entry point.
    let firstStep = steps[0]

    // For 'random' metric, server picks now and sticks for this session.
    let metricShown: SurveyMetric | undefined
    if (isAskMetric(firstStep) && firstStep.config.metric === 'random') {
      const enabled =
        firstStep.config.enabledMetricsForRandom ??
        (['csat', 'nps', 'ces', 'nev', 'cli'] as SurveyMetric[])
      const picked = pickRandomMetric(enabled)
      metricShown = picked
      firstStep = {
        ...firstStep,
        config: { ...firstStep.config, metric: picked },
      }
    } else if (isAskMetric(firstStep) && firstStep.config.metric !== 'random') {
      metricShown = firstStep.config.metric as SurveyMetric
    }

    const sessionId = input.sessionId ?? randomUUID()

    // Idempotent — UNIQUE(survey_id, session_id) prevents dupes.
    await this.db
      .insert(surveyStarts)
      .values({ surveyId: survey.id, sessionId, metadata: {} })
      .onConflictDoNothing()

    return {
      surveyId: survey.id,
      sessionId,
      template: survey.template,
      step: this.publicStep(firstStep),
      metricShown,
      // Public helpers for the renderer (interpolated server-side).
      businessName: await this.resolveBusinessName(survey.workspaceId, survey.locationId),
    }
  }

  /**
   * Advance one step. Validates the answer against the current step's
   * config and returns the next step (or signals completion).
   */
  async advance(input: {
    surveyId: string
    sessionId: string
    fromStepId: string
    /** Whatever the renderer echoes for the just-answered step; the
     *  engine validates against the step kind. Optional because z.unknown()
     *  in the validator infers an optional field — the engine treats
     *  `undefined` as "no answer" and rejects it for required questions. */
    answer?: unknown
    /** When the previous step was AskMetric, the renderer echoes which
     *  metric it showed so the engine can branch correctly. */
    metricShown?: SurveyMetric
    metricScore?: number
  }): Promise<AdvanceResponse> {
    const survey = await this.findSurveyById(input.surveyId)
    const steps = (survey.steps as SurveyStep[]) ?? []
    const fromStep = steps.find((s) => s.id === input.fromStepId)
    if (!fromStep) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown fromStepId' })
    }

    // Validate the answer for the step kind.
    if (isAskMetric(fromStep)) {
      const metric = (input.metricShown ?? fromStep.config.metric) as SurveyMetric
      if (
        typeof input.metricScore !== 'number' ||
        !isScoreInRange(metric, input.metricScore)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Score out of range for metric ${metric}`,
        })
      }
    }
    if (isAskQuestion(fromStep) && fromStep.config.required) {
      const empty =
        input.answer === null ||
        input.answer === undefined ||
        input.answer === '' ||
        (Array.isArray(input.answer) && input.answer.length === 0)
      if (empty) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Answer is required for this step',
        })
      }
    }

    // Resolve next step.
    const nextStepId = this.resolveNextStepId(fromStep, survey, input)
    if (!nextStepId) {
      // No next step — implies terminal (or misconfigured).
      return { done: true, terminalStep: null }
    }

    const nextStep = steps.find((s) => s.id === nextStepId)
    if (!nextStep) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Survey step graph references unknown step "${nextStepId}"`,
      })
    }

    return {
      done: false,
      nextStep: this.publicStep(nextStep),
    }
  }

  /**
   * Terminal — write the survey response, mark the start row complete,
   * fire automation events as appropriate.
   */
  async complete(input: {
    surveyId: string
    sessionId: string
    finalState: {
      metricShown?: SurveyMetric
      metricScore?: number
      answers?: Record<string, unknown>
      contact?: { name?: string; email?: string; phone?: string }
      redirectedTo?: 'google' | 'zomato' | 'swiggy'
      acceptedReviewPrompt?: boolean
    }
    /** Optional terminal step id so the engine knows which end_journey
     *  fired (for triggerEvent / coupon issuance). */
    terminalStepId?: string
  }): Promise<CompleteResponse> {
    const survey = await this.findSurveyById(input.surveyId)
    const steps = (survey.steps as SurveyStep[]) ?? []

    // Optional customer upsert if contact info present.
    let customerId: string | null = null
    if (
      input.finalState.contact &&
      (input.finalState.contact.name ||
        input.finalState.contact.email ||
        input.finalState.contact.phone)
    ) {
      const [customer] = await this.db
        .insert(customers)
        .values({
          workspaceId: survey.workspaceId,
          name: input.finalState.contact.name ?? null,
          email: input.finalState.contact.email ?? null,
          phone: input.finalState.contact.phone ?? null,
        })
        .returning()
      customerId = customer?.id ?? null
    }

    // Compute isPositive for the canonical metric (quick template).
    let isPositive: boolean | null = null
    if (input.finalState.metricShown && typeof input.finalState.metricScore === 'number') {
      const threshold = this.resolveThreshold(survey, input.finalState.metricShown)
      if (threshold !== null) {
        isPositive = isPositiveScore(
          input.finalState.metricShown,
          input.finalState.metricScore,
          threshold,
        )
      }
    }

    // Mirror per-metric score into responseData for backward compat with
    // analytics that read the JSONB shape.
    const responseData: Record<string, unknown> = {
      ...input.finalState.answers,
    }
    if (input.finalState.metricShown && typeof input.finalState.metricScore === 'number') {
      responseData.metricShown = input.finalState.metricShown
      responseData.metricScore = input.finalState.metricScore
      responseData[`${input.finalState.metricShown}Score`] = input.finalState.metricScore
    }
    if (input.finalState.contact) {
      Object.assign(responseData, input.finalState.contact)
    }
    if (input.finalState.acceptedReviewPrompt !== undefined) {
      responseData.acceptedReviewPrompt = input.finalState.acceptedReviewPrompt
    }
    if (input.finalState.redirectedTo) {
      responseData.redirectedTo = input.finalState.redirectedTo
    }

    const now = new Date()
    const [response] = await this.db
      .insert(surveyResponses)
      .values({
        surveyId: survey.id,
        workspaceId: survey.workspaceId,
        locationId: survey.locationId,
        customerId,
        sessionId: input.sessionId,
        responseData,
        metricShown: input.finalState.metricShown ?? null,
        metricScore:
          typeof input.finalState.metricScore === 'number'
            ? input.finalState.metricScore
            : null,
        isPositive,
        // Deep-template hot-path columns
        score: typeof input.finalState.metricScore === 'number' ? input.finalState.metricScore : null,
        answers: (input.finalState.answers as Record<string, unknown>) ?? null,
        completedAt: now,
        metadata: {},
      })
      .returning()

    // Mark the start row complete.
    await this.db
      .update(surveyStarts)
      .set({ completedAt: now })
      .where(
        and(
          eq(surveyStarts.surveyId, survey.id),
          eq(surveyStarts.sessionId, input.sessionId),
        ),
      )

    // Find the terminal step's config (for coupon / triggerEvent hints).
    const terminal = input.terminalStepId
      ? (steps.find((s) => s.id === input.terminalStepId) as EndJourneyStep | undefined)
      : (steps.find((s) => isEndJourney(s)) as EndJourneyStep | undefined)

    return {
      responseId: response.id,
      isPositive,
      terminalMessage: terminal?.config.message ?? 'Thank you!',
      triggerEvent:
        terminal?.config.triggerEvent ??
        (isPositive === true
          ? 'journey_completed_positive'
          : isPositive === false
            ? 'journey_completed_negative'
            : null),
      issueCouponTemplateId: terminal?.config.issueCoupon?.templateId ?? null,
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  /**
   * Compute the next step id given the just-completed step + the customer's
   * answer. Pure logic (modulo threshold lookup).
   */
  resolveNextStepId(
    fromStep: SurveyStep,
    survey: typeof surveys.$inferSelect,
    input: {
      answer?: unknown
      metricShown?: SurveyMetric
      metricScore?: number
    },
  ): string | null {
    if (isAskMetric(fromStep)) {
      return fromStep.config.onComplete.nextStepId ?? null
    }
    if (isAskQuestion(fromStep)) {
      return fromStep.config.onComplete.nextStepId ?? null
    }
    if (isShowMessage(fromStep)) {
      return fromStep.config.nextStepId ?? null
    }
    if (isCollectContact(fromStep)) {
      return (fromStep as CollectContactStep).config.nextStepId ?? null
    }
    if (isRedirect(fromStep)) {
      const r = fromStep as RedirectStep
      // The renderer signals Yes/No via `answer` ('yes' | 'no').
      return input.answer === 'yes'
        ? r.config.onYesNextStepId ?? null
        : r.config.onNoNextStepId ?? null
    }
    if (isBranchByScore(fromStep)) {
      const b = fromStep as BranchByScoreStep
      const score =
        typeof input.metricScore === 'number' ? input.metricScore : NaN
      if (Number.isNaN(score)) return b.config.defaultNextStepId
      const metric = input.metricShown
      return pickNextStepIdByScore(b, score, () =>
        metric ? this.resolveThreshold(survey, metric) : null,
      )
    }
    if (isBranchByAnswer(fromStep)) {
      const b = fromStep as BranchByAnswerStep
      return pickNextStepIdByAnswer(b, input.answer)
    }
    if (isEndJourney(fromStep)) {
      return null
    }
    return null
  }

  private resolveThreshold(
    survey: typeof surveys.$inferSelect,
    metric: SurveyMetric,
  ): number | null {
    const settings = (survey.settings ?? {}) as {
      thresholds?: Partial<Record<SurveyMetric, number>>
    }
    return (
      settings.thresholds?.[metric] ??
      METRIC_DEFAULT_THRESHOLDS[metric] ??
      null
    )
  }

  private async findActiveSurveyBySlug(slug: string) {
    const survey = await this.db.query.surveys.findFirst({
      where: and(eq(surveys.slug, slug), eq(surveys.status, 'active')),
    })
    if (!survey || survey.archivedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' })
    }
    return survey
  }

  private async findSurveyById(id: string) {
    const survey = await this.db.query.surveys.findFirst({
      where: eq(surveys.id, id),
    })
    if (!survey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' })
    }
    return survey
  }

  private async resolveBusinessName(
    workspaceId: string,
    locationId: string | null,
  ): Promise<string> {
    if (locationId) {
      const loc = await this.db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      })
      if (loc?.name) return loc.name
    }
    const ws = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })
    return ws?.name ?? 'us'
  }

  /**
   * Public-facing shape of a step. We strip internal builder hints
   * (positions, branchConditions raw config) and pre-interpolate copy
   * where applicable.
   */
  private publicStep(step: SurveyStep): SurveyStep {
    // For now, identical — the renderer can read the step verbatim.
    // Future work: strip builder-only fields, interpolate copy.
    return step
  }
}

// ─── Public response shapes ──────────────────────────────────────────────

export interface InitialStateResponse {
  surveyId: string
  sessionId: string
  template: 'quick' | 'deep'
  step: SurveyStep
  metricShown?: SurveyMetric
  businessName: string
}

export type AdvanceResponse =
  | { done: false; nextStep: SurveyStep }
  | { done: true; terminalStep: SurveyStep | null }

export interface CompleteResponse {
  responseId: string
  isPositive: boolean | null
  terminalMessage: string
  triggerEvent: 'journey_completed_positive' | 'journey_completed_negative' | null
  issueCouponTemplateId: string | null
}
