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
  reviews,
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

  // ─── Phase 3 Stage E — legacy compat shim ──────────────────────────────
  //
  // These two methods exist to keep `/j/{slug}` and `/f/{slug}` URLs
  // working without dual-writing to the now-frozen legacy tables. The
  // legacy renderer pages (apps/web/src/app/{j,f}/[slug]/page.tsx) call
  // these instead of the deprecated journey.submitResponse / truform.
  // submitResponse mutations.
  //
  // Behaviour mirrors the legacy submit flow exactly so the renderer
  // can stay on its existing two-phase + immediate-submit shapes; only
  // the storage destination changes (journey_responses → survey_responses,
  // truform_responses → survey_responses).
  //
  // Phase 5 (T+1mo) drops the legacy URL paths AND these shim methods
  // along with the legacy tables.

  /**
   * Drop-in replacement for the legacy `journey.submitResponse` mutation.
   * Same input shape, same return shape — the renderer doesn't have to
   * change its UI logic, just which mutation it calls.
   */
  async submitLegacyJourney(input: {
    journeyId: string
    journeyScreenId?: string
    locationId?: string
    sessionId: string
    responseData: Record<string, unknown>
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    updateResponseId?: string
  }): Promise<{ success: true; responseId: string; isPositive: boolean | null }> {
    // 1. Find the survey backing this legacy journey id.
    const survey = await this.db.query.surveys.findFirst({
      where: eq(surveys.legacyJourneyId, input.journeyId),
    })
    if (!survey) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No survey backs this legacy journey id',
      })
    }
    if (survey.template !== 'quick') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Legacy journey shim used on a deep-template survey',
      })
    }

    // ===== PHASE 2: merge into existing response =====
    if (input.updateResponseId) {
      const existing = await this.db.query.surveyResponses.findFirst({
        where: and(
          eq(surveyResponses.id, input.updateResponseId),
          eq(surveyResponses.surveyId, survey.id),
        ),
      })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Response not found' })
      }

      let customerId = existing.customerId ?? null
      if (
        !customerId &&
        (input.customerName || input.customerEmail || input.customerPhone)
      ) {
        const [customer] = await this.db
          .insert(customers)
          .values({
            workspaceId: survey.workspaceId,
            name: input.customerName ?? null,
            email: input.customerEmail ?? null,
            phone: input.customerPhone ?? null,
          })
          .returning()
        customerId = customer?.id ?? null
      }

      const merged: Record<string, unknown> = {
        ...((existing.responseData ?? {}) as Record<string, unknown>),
        ...input.responseData,
      }

      const metricShown =
        (merged.metricShown as SurveyMetric | undefined) ?? undefined
      const metricScore =
        typeof merged.metricScore === 'number'
          ? (merged.metricScore as number)
          : undefined
      const isPos = this.computeLegacyIsPositive(survey, metricShown, metricScore)

      await this.db
        .update(surveyResponses)
        .set({
          responseData: merged,
          customerId: customerId ?? existing.customerId,
          metricShown: metricShown ?? existing.metricShown,
          metricScore: metricScore ?? existing.metricScore,
          isPositive: isPos !== null ? isPos : existing.isPositive,
          completedAt: new Date(),
        })
        .where(eq(surveyResponses.id, input.updateResponseId))

      // Create offline review on unhappy-path completion (legacy parity).
      if (metricShown && metricScore !== undefined && isPos === false) {
        const aspectTags = (merged.aspectTags as string[] | undefined) ?? null
        await this.db
          .insert(reviews)
          .values({
            workspaceId: survey.workspaceId,
            locationId: existing.locationId ?? input.locationId ?? null,
            platform: 'offline' as any,
            platformReviewId: `offline-${existing.id}`,
            reviewerName: input.customerName || 'Anonymous',
            rating: 2,
            text: (merged.feedback as string) ?? null,
            reviewedAt: new Date(),
            source: 'offline' as any,
            // The legacy column was journey_response_id; on the new schema
            // it doesn't exist — the link is via reviews.metadata.surveyResponseId
            // for analytics. Future cleanup happens in Phase 5.
            aspectTags,
            customerId: customerId ?? null,
            metadata: {
              metricShown,
              metricScore,
              surveyResponseId: existing.id,
            } as any,
          })
          .onConflictDoNothing()
      }

      return { success: true, responseId: existing.id, isPositive: isPos }
    }

    // ===== PHASE 1: first submit =====
    const data = input.responseData
    const metricShown = data.metricShown as SurveyMetric | undefined
    const metricScore = data.metricScore as number | undefined

    if (!metricShown) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'metricShown is required' })
    }
    if (typeof metricScore !== 'number' || !isScoreInRange(metricShown, metricScore)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Score out of range for metric ${metricShown}`,
      })
    }

    const isPos = this.computeLegacyIsPositive(survey, metricShown, metricScore)

    // Mirror metricScore into the per-metric field for analytics back-compat.
    const responseData: Record<string, unknown> = { ...data }
    responseData[`${metricShown}Score`] = metricScore

    let customerId: string | null = null
    if (input.customerName || input.customerEmail || input.customerPhone) {
      const [customer] = await this.db
        .insert(customers)
        .values({
          workspaceId: survey.workspaceId,
          name: input.customerName ?? null,
          email: input.customerEmail ?? null,
          phone: input.customerPhone ?? null,
        })
        .returning()
      customerId = customer?.id ?? null
    }

    // Idempotent start row (per legacy semantics — survey_starts exists).
    await this.db
      .insert(surveyStarts)
      .values({ surveyId: survey.id, sessionId: input.sessionId, metadata: {} })
      .onConflictDoNothing()

    const [response] = await this.db
      .insert(surveyResponses)
      .values({
        surveyId: survey.id,
        workspaceId: survey.workspaceId,
        locationId: input.locationId ?? survey.locationId ?? null,
        customerId,
        sessionId: input.sessionId,
        responseData,
        metricShown,
        metricScore,
        isPositive: isPos,
        score: metricScore,
        answers: {},
        // legacy submit collects metric on first call; consider it complete
        // for the purposes of analytics. The follow-up call (Phase 2 above)
        // re-stamps completedAt and merges contact info.
        completedAt: new Date(),
        metadata: {},
      })
      .returning()

    return { success: true, responseId: response.id, isPositive: isPos }
  }

  /**
   * Drop-in replacement for the legacy `truform.submitResponse` mutation.
   * Single-call (no two-phase), writes to survey_responses backing the
   * deep-template survey.
   */
  async submitLegacyTruform(input: {
    truformId: string
    score?: number
    answers: Record<string, unknown>
    metadata: Record<string, unknown>
  }): Promise<{ success: true; responseId: string }> {
    const survey = await this.db.query.surveys.findFirst({
      where: eq(surveys.legacyTruformId, input.truformId),
    })
    if (!survey) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No survey backs this legacy truform id',
      })
    }
    if (survey.template !== 'deep') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Legacy truform shim used on a quick-template survey',
      })
    }

    const sessionId = randomUUID()
    await this.db
      .insert(surveyStarts)
      .values({ surveyId: survey.id, sessionId, metadata: {} })
      .onConflictDoNothing()

    const [response] = await this.db
      .insert(surveyResponses)
      .values({
        surveyId: survey.id,
        workspaceId: survey.workspaceId,
        locationId: survey.locationId ?? null,
        sessionId,
        responseData: input.answers,
        score: input.score ?? null,
        answers: input.answers,
        completedAt: new Date(),
        metadata: input.metadata ?? {},
      })
      .returning()

    return { success: true, responseId: response.id }
  }

  private computeLegacyIsPositive(
    survey: typeof surveys.$inferSelect,
    metric: SurveyMetric | undefined,
    score: number | undefined,
  ): boolean | null {
    if (!metric || score === undefined) return null
    const threshold = this.resolveThreshold(survey, metric)
    if (threshold === null) return null
    return isPositiveScore(metric, score, threshold)
  }

  // ─── Phase 5 — legacy-shape read endpoints ─────────────────────────────
  //
  // Reconstruct the old `journey.getPublic` / `truform.getPublic` payload
  // from a survey row + its step graph. The renderer pages keep their
  // existing UI logic — only the query target changes.

  /**
   * Returns the legacy journey shape from a quick-template survey.
   * The renderer reads metricShown, aspectTags, redirectLinks, copy
   * strings — all pulled from the step graph that was generated by the
   * Phase 3 backfill (or by survey.create with template=quick).
   */
  async getPublicLegacyJourney(input: { slug: string }): Promise<LegacyJourneyShape> {
    const survey = await this.findActiveSurveyBySlug(input.slug)
    if (survey.template !== 'quick') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Slug resolves to a deep-template survey; use getPublicLegacyTruform instead',
      })
    }

    const steps = (survey.steps as SurveyStep[]) ?? []
    const metricStep = steps.find((s) => isAskMetric(s)) as
      | AskMetricStep
      | undefined
    const redirectStep = steps.find((s) => isRedirect(s)) as
      | RedirectStep
      | undefined
    // Unhappy-path question step — heuristic: the first ask_question step
    // whose options shape looks like aspect tags.
    const unhappyAskStep = steps.find(
      (s) => isAskQuestion(s) && Array.isArray((s as any).config.options),
    ) as { id: string; config: { options?: string[] } } | undefined
    const endSteps = steps.filter((s) => isEndJourney(s)) as EndJourneyStep[]

    // Resolve metric — for 'random' surveys we pick on each request, same
    // behaviour as the legacy renderer (stateless across page loads).
    let metricShown: SurveyMetric = 'csat'
    if (metricStep) {
      metricShown =
        metricStep.config.metric === 'random'
          ? pickRandomMetric(
              metricStep.config.enabledMetricsForRandom ?? [
                'csat',
                'nps',
                'ces',
                'nev',
                'cli',
              ],
            )
          : (metricStep.config.metric as SurveyMetric)
    }

    const settings = (survey.settings ?? {}) as {
      reviewPlatform?: 'google' | 'zomato' | 'swiggy'
    }
    const platform = settings.reviewPlatform ?? 'google'

    // Map terminal step ids back to the legacy thank-you slots. The
    // intelligent step builder uses fixed ids (s4_thanks_yes / _no /
    // _unhappy); deep-builder surveys may use different ids — fall back
    // to triggerEvent matching when ids don't line up.
    const thanksYes =
      endSteps.find((s) => s.id === 's4_thanks_yes')?.config.message ??
      endSteps.find((s) => s.config.triggerEvent === 'journey_completed_positive')
        ?.config.message ??
      'Thank you!'
    const thanksNo =
      endSteps.find((s) => s.id === 's4_thanks_no')?.config.message ?? thanksYes
    const thanksUnhappy =
      endSteps.find((s) => s.id === 's4_thanks_unhappy')?.config.message ??
      endSteps.find((s) => s.config.triggerEvent === 'journey_completed_negative')
        ?.config.message ??
      'Thanks for the feedback.'

    return {
      // legacy_journey_id is what `submitLegacyJourney` looks up by, so we
      // surface it as `id`. Falls back to survey.id for surveys created
      // post-Phase-3 (no legacy backing). submitLegacyJourney handles
      // both because surveys.legacyJourneyId may match input.journeyId.
      id: survey.legacyJourneyId ?? survey.id,
      slug: survey.slug,
      name: survey.name,
      locationId: survey.locationId,
      settings: { reviewPlatform: platform },
      screen: {
        // Synthetic — the legacy renderer uses this only as journeyScreenId
        // in submit, where it's optional. A stable per-survey id is fine.
        id: `${survey.id}-screen`,
        metricShown,
        question: metricStep?.config.question ?? 'How was your experience?',
        scaleLabels:
          (metricStep?.config.scaleLabels as { low: string; high: string }) ??
          { low: '', high: '' },
        aspectTags: unhappyAskStep?.config.options ?? [],
        feedbackPlaceholder: 'Tell us more (optional)…',
        reviewPromptCopy: {
          question: 'Would you mind leaving a review?',
          yesLabel: redirectStep?.config.yesLabel ?? 'Sure',
          noLabel: redirectStep?.config.noLabel ?? 'Maybe later',
        },
        redirectLinks: redirectStep
          ? { [redirectStep.config.platform]: redirectStep.config.url }
          : {},
        reviewTemplate: redirectStep?.config.reviewTemplate ?? '',
        thankYouHappyYes: thanksYes,
        thankYouHappyNo: thanksNo,
        thankYouUnhappy: thanksUnhappy,
      },
    }
  }

  /**
   * Returns the legacy truform shape from a deep-template survey. The
   * renderer only reads {id, name, type, config.brandColor, config.
   * thankYouMessage} so the reconstruction is straightforward.
   */
  async getPublicLegacyTruform(input: { slug: string }): Promise<LegacyTruformShape> {
    const survey = await this.findActiveSurveyBySlug(input.slug)
    if (survey.template !== 'deep') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Slug resolves to a quick-template survey; use getPublicLegacyJourney instead',
      })
    }
    const settings = (survey.settings ?? {}) as {
      type?: 'nps' | 'csat' | 'ces' | 'custom'
      branding?: { brandColor?: string }
      thankYouMessage?: string
    }
    return {
      id: survey.legacyTruformId ?? survey.id,
      name: survey.name,
      type: (settings.type ?? 'csat') as 'nps' | 'csat' | 'ces' | 'custom',
      config: {
        brandColor: settings.branding?.brandColor ?? '#6366f1',
        thankYouMessage:
          settings.thankYouMessage ?? 'Thank you for your feedback!',
      },
    }
  }
}

export interface LegacyJourneyShape {
  id: string
  slug: string
  name: string
  locationId: string | null
  settings: { reviewPlatform: 'google' | 'zomato' | 'swiggy' }
  screen: {
    id: string
    metricShown: SurveyMetric
    question: string
    scaleLabels: { low: string; high: string }
    aspectTags: string[]
    feedbackPlaceholder: string
    reviewPromptCopy: { question: string; yesLabel: string; noLabel: string }
    redirectLinks: Partial<Record<'google' | 'zomato' | 'swiggy', string>>
    reviewTemplate: string
    thankYouHappyYes: string
    thankYouHappyNo: string
    thankYouUnhappy: string
  }
}

export interface LegacyTruformShape {
  id: string
  name: string
  type: 'nps' | 'csat' | 'ces' | 'custom'
  config: {
    brandColor: string
    thankYouMessage: string
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
