import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
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
import { AdaptiveEngineService } from './adaptive-engine.service'
import { resolvePublicBranding } from './branding.helper'
import {
  type SurveyStep,
  type SurveyMetric,
  type PublicBranding,
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

// OpenRouter client for Journey A Step 3a.1 (happy review draft). Mirrors
// the pattern in ai-response.service.ts — created at module load with
// `|| ''` so the SDK doesn't crash when OPENROUTER_API_KEY is missing;
// the call site checks the env var before invoking and falls back to a
// static template if absent.
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'OptimizerV6 - Rectangled.io',
  },
})

const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini'

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
  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly adaptiveEngine: AdaptiveEngineService,
  ) {}

  /**
   * Public entry point — first visit. Returns the resolved first step
   * (with any random-metric pick already made) plus the session id.
   */
  async getInitialState(input: {
    slug: string
    sessionId?: string
    /**
     * Path B — preview mode parity with the legacy shims. When true the
     * engine drops the `status='active'` filter so owners can walk a
     * draft survey end-to-end from the editor's Preview button, and
     * skips the `survey_starts` insert so preview traffic doesn't
     * pollute the abandonment metric.
     */
    preview?: boolean
  }): Promise<InitialStateResponse> {
    const survey = await this.findActiveSurveyBySlug(input.slug, {
      allowDraft: !!input.preview,
    })
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

    // Preview traffic doesn't write a start row (would pollute the
    // abandonment / completion-rate metric).
    if (!input.preview) {
      // Idempotent — UNIQUE(survey_id, session_id) prevents dupes.
      await this.db
        .insert(surveyStarts)
        .values({ surveyId: survey.id, sessionId, metadata: {} })
        .onConflictDoNothing()
    }

    // Path B — resolve branding the same way the legacy shims do so the
    // step-walker renderer has everything it needs in one round trip.
    const branding = await resolvePublicBranding(
      this.db,
      survey.workspaceId,
      survey.locationId,
    )

    return {
      surveyId: survey.id,
      sessionId,
      template: survey.template,
      step: this.publicStep(firstStep),
      metricShown,
      // Public helpers for the renderer (interpolated server-side).
      businessName: await this.resolveBusinessName(survey.workspaceId, survey.locationId),
      branding,
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

    // Path B — auto-traverse internal-only steps (branch_by_score,
    // branch_by_answer) so the FE only ever receives renderable steps.
    // Customers never "see" a branch — it's a server-side routing
    // decision. We keep the caller's `input` context (metricShown +
    // metricScore + answer) in scope while traversing because a branch
    // immediately after a metric step needs to read the score that was
    // just submitted to that metric step. Branches further in the graph
    // that reference distant context will fall through to
    // `defaultNextStepId` (see resolveNextStepId for the contract).
    let cursor: SurveyStep = fromStep
    // Guard against pathological cycles in user-built graphs.
    for (let hops = 0; hops < 32; hops++) {
      const nextStepId = this.resolveNextStepId(cursor, survey, input)
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
      // end_journey is terminal — surface it as terminalStep so the FE
      // calls complete() with that step's id for coupon/triggerEvent.
      if (isEndJourney(nextStep)) {
        return { done: true, terminalStep: this.publicStep(nextStep) }
      }
      // Renderable step — hand it to the FE.
      if (
        isAskMetric(nextStep) ||
        isAskQuestion(nextStep) ||
        isShowMessage(nextStep) ||
        isCollectContact(nextStep) ||
        isRedirect(nextStep)
      ) {
        return { done: false, nextStep: this.publicStep(nextStep) }
      }
      // Branch — keep traversing using the same input context.
      cursor = nextStep
    }
    this.logger.warn(
      `advance: 32-hop traversal cap hit for survey ${input.surveyId} starting at ${input.fromStepId} — possible cycle in step graph`,
    )
    return { done: true, terminalStep: null }
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
    /** Path B — preview mode. No writes; just compute the terminal
     *  message + isPositive for the renderer's thank-you screen. */
    preview?: boolean
  }): Promise<CompleteResponse> {
    const survey = await this.findSurveyById(input.surveyId)
    const steps = (survey.steps as SurveyStep[]) ?? []

    // Preview short-circuit — compute the thank-you message + isPositive
    // for the renderer, but skip all writes so editor previews don't
    // pollute customers / survey_responses / survey_starts.
    if (input.preview) {
      let isPositive: boolean | null = null
      if (
        input.finalState.metricShown &&
        typeof input.finalState.metricScore === 'number'
      ) {
        const threshold = this.resolveThreshold(survey, input.finalState.metricShown)
        if (threshold !== null) {
          isPositive = isPositiveScore(
            input.finalState.metricShown,
            input.finalState.metricScore,
            threshold,
          )
        }
      }
      const terminal = input.terminalStepId
        ? (steps.find((s) => s.id === input.terminalStepId) as
            | EndJourneyStep
            | undefined)
        : (steps.find((s) => isEndJourney(s)) as EndJourneyStep | undefined)
      return {
        responseId: 'preview',
        isPositive,
        terminalMessage: terminal?.config.message ?? 'Thank you!',
        triggerEvent: terminal?.config.triggerEvent ?? null,
        issueCouponTemplateId: terminal?.config.issueCoupon?.templateId ?? null,
      }
    }

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

  private async findActiveSurveyBySlug(
    slug: string,
    options: { allowDraft?: boolean } = {},
  ) {
    // Hotfix-2 — owners pre-activate via the editor's Preview button.
    // For preview, we drop the active-status filter so freshly-created
    // draft surveys can be walked end-to-end before going live. Submit
    // endpoints already no-op persistence when called with preview=true,
    // so allowing GET to return drafts is safe — no public traffic
    // sees draft surveys without the slug + ?preview=true gate.
    const where = options.allowDraft
      ? eq(surveys.slug, slug)
      : and(eq(surveys.slug, slug), eq(surveys.status, 'active'))
    const survey = await this.db.query.surveys.findFirst({ where })
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
    /**
     * Hotfix PRD §3.6 — preview mode. When true, returns a synthetic
     * success without writing to survey_starts / survey_responses /
     * customers / reviews. The renderer behaves identically; the
     * server just no-ops the persistence.
     */
    preview?: boolean
  }): Promise<{ success: true; responseId: string; isPositive: boolean | null }> {
    // 1. Find the survey backing this legacy journey id. Custom and
    //    post-merger quick surveys don't have legacy_journey_id set;
    //    `getPublicLegacyJourney` surfaces survey.id as the renderer's
    //    `journeyId` in that case, so we fall back to a survey.id lookup.
    let survey = await this.db.query.surveys.findFirst({
      where: eq(surveys.legacyJourneyId, input.journeyId),
    })
    if (!survey) {
      survey = await this.db.query.surveys.findFirst({
        where: eq(surveys.id, input.journeyId),
      })
    }
    if (!survey) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No survey backs this legacy journey id',
      })
    }

    // Hotfix §2 — delegate to AdaptiveEngineService when the survey's
    // template was migrated to 'adaptive' (migration 0019). The legacy
    // renderer at /j/{slug} keeps calling submitLegacyJourney with the
    // same input shape; we just route it through the dedicated engine
    // which runs the v2 flow directly from settings instead of via the
    // step graph.
    if (survey.template === 'adaptive') {
      return this.delegateToAdaptive(survey, input)
    }

    // Hotfix §3 — custom surveys share the quick step-graph shape and
    // run through the same code path here. The wizard locks structure
    // so the engine logic below works identically.
    if (survey.template !== 'quick' && survey.template !== 'custom') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Legacy journey shim used on a deep-template survey',
      })
    }

    // Hotfix §3.6 — preview short-circuit. Return a synthetic success
    // before any DB write. The renderer still advances to the next
    // screen (positive vs negative path) based on the metric score it
    // already knows; we just compute is_positive without persisting.
    if (input.preview) {
      const data = input.responseData
      const previewMetric = data.metricShown as SurveyMetric | undefined
      const previewScore = data.metricScore as number | undefined
      const previewIsPositive =
        previewMetric && typeof previewScore === 'number'
          ? this.computeLegacyIsPositive(survey, previewMetric, previewScore)
          : null
      return {
        success: true,
        responseId: `preview-${input.sessionId}`,
        isPositive: previewIsPositive,
      }
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
    // Hotfix PRD §6 — contact fields now wired to customer upsert.
    // Were silently dropped pre-hotfix.
    customerName?: string
    customerEmail?: string
    customerPhone?: string
  }): Promise<{
    success: true
    responseId: string
    isPositive: boolean | null
    customerId: string | null
  }> {
    // Hotfix-2 — mirror the §3 PR 3 fallback for `submitLegacyJourney`.
    // The renderer at /f/{slug} gets `truformId` from `getPublicLegacyTruform`
    // which surfaces `survey.legacyTruformId ?? survey.id`. For surveys
    // created post-Phase-3 (no legacy_truform_id), the renderer ends up
    // sending surveys.id back here — the legacy lookup misses, then we
    // fall through to the surveys.id lookup. Both resolve to the same
    // row when one exists.
    let survey = await this.db.query.surveys.findFirst({
      where: eq(surveys.legacyTruformId, input.truformId),
    })
    if (!survey) {
      survey = await this.db.query.surveys.findFirst({
        where: eq(surveys.id, input.truformId),
      })
    }
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

    // Idempotent start row — closes the abandonment-tracking gap
    // (matches the journey shim's PHASE 1 behaviour).
    await this.db
      .insert(surveyStarts)
      .values({ surveyId: survey.id, sessionId, metadata: {} })
      .onConflictDoNothing()

    // ─── Hotfix PRD §6 — customer upsert ─────────────────────────────
    // Workspace-scoped lookup by phone first (more unique than email
    // for SMB use cases in India), then by email. If found, update any
    // missing fields. Otherwise create a fresh customer row.
    let customerId: string | null = null
    if (input.customerName || input.customerEmail || input.customerPhone) {
      let existing: typeof customers.$inferSelect | undefined
      if (input.customerPhone) {
        existing = await this.db.query.customers.findFirst({
          where: and(
            eq(customers.workspaceId, survey.workspaceId),
            eq(customers.phone, input.customerPhone),
          ),
        })
      }
      if (!existing && input.customerEmail) {
        existing = await this.db.query.customers.findFirst({
          where: and(
            eq(customers.workspaceId, survey.workspaceId),
            eq(customers.email, input.customerEmail),
          ),
        })
      }

      if (existing) {
        customerId = existing.id
        // Patch missing fields without overwriting existing values.
        const patch: Partial<typeof customers.$inferInsert> = {}
        if (!existing.name && input.customerName) patch.name = input.customerName
        if (!existing.email && input.customerEmail) patch.email = input.customerEmail
        if (!existing.phone && input.customerPhone) patch.phone = input.customerPhone
        if (Object.keys(patch).length > 0) {
          await this.db
            .update(customers)
            .set({ ...patch, lastSeenAt: new Date() })
            .where(eq(customers.id, existing.id))
        }
      } else {
        const [created] = await this.db
          .insert(customers)
          .values({
            workspaceId: survey.workspaceId,
            name: input.customerName ?? null,
            email: input.customerEmail ?? null,
            phone: input.customerPhone ?? null,
          })
          .returning()
        customerId = created?.id ?? null
      }
    }

    // ─── Hotfix PRD §6 — compute is_positive from settings.type ──────
    // Truform surveys carry metric type in survey.settings.type; apply
    // the same threshold table as METRIC_DEFAULT_THRESHOLDS.
    const settings = (survey.settings ?? {}) as { type?: string }
    let isPos: boolean | null = null
    if (typeof input.score === 'number') {
      switch (settings.type) {
        case 'csat':
          isPos = input.score >= 4
          break
        case 'nps':
          isPos = input.score >= 9
          break
        case 'ces':
          isPos = input.score <= 3 // inverted
          break
        // 'custom' has no canonical threshold — leave null.
      }
    }

    const [response] = await this.db
      .insert(surveyResponses)
      .values({
        surveyId: survey.id,
        workspaceId: survey.workspaceId,
        locationId: survey.locationId ?? null,
        customerId,
        sessionId,
        responseData: input.answers,
        score: input.score ?? null,
        answers: input.answers,
        // Mirror score into metric_shown / metric_score / is_positive
        // hot-path columns so the Responses tab can filter on them
        // without parsing the parent survey's settings.
        metricShown: (settings.type ?? null) as any,
        metricScore: input.score ?? null,
        isPositive: isPos,
        completedAt: new Date(),
        metadata: input.metadata ?? {},
      })
      .returning()

    // Mark the start row complete so the funnel analytics work.
    await this.db
      .update(surveyStarts)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(surveyStarts.surveyId, survey.id),
          eq(surveyStarts.sessionId, sessionId),
        ),
      )

    return {
      success: true,
      responseId: response.id,
      isPositive: isPos,
      customerId,
    }
  }

  /**
   * Hotfix §2 — bridge between the legacy `/j/{slug}` renderer's input
   * shape and the AdaptiveEngineService's typed methods. Translates
   * PHASE 1 (no `updateResponseId`) → submitMetric, PHASE 2 (with
   * `updateResponseId`) → submitFollowup. Output shape matches the
   * existing submitLegacyJourney return so the renderer doesn't see
   * the engine swap.
   */
  private async delegateToAdaptive(
    survey: typeof surveys.$inferSelect,
    input: {
      journeyId: string
      sessionId: string
      responseData: Record<string, unknown>
      locationId?: string
      customerName?: string
      customerEmail?: string
      customerPhone?: string
      updateResponseId?: string
    },
  ): Promise<{ success: true; responseId: string; isPositive: boolean | null }> {
    if (input.updateResponseId) {
      // PHASE 2 — follow-up.
      const data = input.responseData as Record<string, unknown>
      const res = await this.adaptiveEngine.submitFollowup({
        surveyId: survey.id,
        sessionId: input.sessionId,
        responseId: input.updateResponseId,
        patch: {
          acceptedReviewPrompt:
            typeof data.acceptedReviewPrompt === 'boolean'
              ? data.acceptedReviewPrompt
              : undefined,
          redirectedTo:
            data.redirectedTo === 'google' ||
            data.redirectedTo === 'zomato' ||
            data.redirectedTo === 'swiggy'
              ? data.redirectedTo
              : undefined,
          aspectTags: Array.isArray(data.aspectTags)
            ? (data.aspectTags as string[])
            : undefined,
          feedback:
            typeof data.feedback === 'string' ? data.feedback : undefined,
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone,
        },
        locationId: input.locationId,
      })
      return {
        success: true,
        responseId: res.responseId,
        isPositive: res.isPositive,
      }
    }

    // PHASE 1 — first submit. Need metricShown + metricScore.
    const data = input.responseData as Record<string, unknown>
    const metricShown = data.metricShown as SurveyMetric | undefined
    const metricScore = data.metricScore as number | undefined
    if (!metricShown) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'metricShown is required',
      })
    }
    if (typeof metricScore !== 'number') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'metricScore must be a number',
      })
    }
    return this.adaptiveEngine.submitMetric({
      surveyId: survey.id,
      sessionId: input.sessionId,
      metricShown,
      metricScore,
      locationId: input.locationId,
    })
  }

  /**
   * Hotfix §2 — translates the AdaptiveEngineService's typed
   * getInitialState response into the legacy journey shape the
   * /j/{slug} renderer expects. Crucially: NO threshold field leaks
   * through this translation.
   */
  private async legacyShapeFromAdaptive(
    survey: typeof surveys.$inferSelect,
    slug: string,
    branding: PublicBranding,
    preview = false,
  ): Promise<LegacyJourneyShape> {
    const initial = await this.adaptiveEngine.getInitialState({ slug, preview })

    return {
      // Renderer uses this as `journeyId` for submit. We pass survey.id
      // here (not legacy_journey_id) because submitLegacyJourney's
      // delegation path tries legacyJourneyId first, falls back to id —
      // either resolves to the same survey row.
      id: survey.legacyJourneyId ?? survey.id,
      slug: survey.slug,
      name: survey.name,
      locationId: survey.locationId,
      settings: { reviewPlatform: initial.reviewPlatform },
      branding,
      screen: {
        // Synthetic — adaptive surveys have no screen rows. Renderer
        // uses this only as journeyScreenId in submit, where it's optional.
        id: `${survey.id}-adaptive`,
        metricShown: initial.metricShown,
        question: initial.question,
        scaleLabels: initial.scaleLabels,
        aspectTags: initial.aspectTags,
        feedbackPlaceholder: initial.feedbackPlaceholder,
        reviewPromptCopy: initial.reviewPromptCopy,
        // Only the active platform's URL surfaces here — not the full map.
        redirectLinks: { [initial.reviewPlatform]: initial.redirectUrl },
        reviewTemplate: initial.reviewTemplate,
        thankYouHappyYes: initial.thankYouHappyYes,
        thankYouHappyNo: initial.thankYouHappyNo,
        thankYouUnhappy: initial.thankYouUnhappy,
      },
    }
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
  async getPublicLegacyJourney(input: {
    slug: string
    preview?: boolean
  }): Promise<LegacyJourneyShape> {
    const survey = await this.findActiveSurveyBySlug(input.slug, {
      allowDraft: !!input.preview,
    })

    // Hotfix §4 — resolve branding once at the top so all paths
    // (adaptive delegation + direct quick/custom construction) include
    // the same branding shape in the response.
    const branding = await resolvePublicBranding(
      this.db,
      survey.workspaceId,
      survey.locationId,
    )

    // Hotfix §2 — adaptive surveys delegate to AdaptiveEngineService.
    // The legacy shape is reconstructed from the engine's response so the
    // /j/{slug} renderer doesn't have to change.
    if (survey.template === 'adaptive') {
      return this.legacyShapeFromAdaptive(
        survey,
        input.slug,
        branding,
        !!input.preview,
      )
    }

    if (survey.template !== 'quick' && survey.template !== 'custom') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Slug resolves to a deep-template survey; use getPublicLegacyTruform instead',
      })
    }
    // Hotfix PRD §3 — `template='custom'` surveys share the wizard's
    // step-graph shape with quick surveys (s1_metric → s2_branch → ...),
    // so the same legacy-shape reconstruction works for both. The only
    // structural divergence is the just_thank case where there's no
    // redirect step — handled below by the redirect/redirectStep being
    // undefined falling back to redirectLinks={}.

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

    // Phase 2 — fall back to workspace-level default redirect URLs (set
    // during onboarding's review-platform step). The redirect step's
    // explicit URL on the survey takes precedence; if absent, every
    // platform's URL from workspace.settings.defaultRedirectLinks gets
    // surfaced so the renderer can resolve `redirectLinks[platform]`.
    const workspaceRow = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, survey.workspaceId),
    })
    const workspaceDefaults =
      workspaceRow?.settings?.defaultRedirectLinks ?? {}

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
      branding,
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
        // Phase 2 — survey-step URL wins; workspace defaults fill the gaps.
        redirectLinks: {
          ...(workspaceDefaults.google ? { google: workspaceDefaults.google } : {}),
          ...(workspaceDefaults.zomato ? { zomato: workspaceDefaults.zomato } : {}),
          ...(workspaceDefaults.swiggy ? { swiggy: workspaceDefaults.swiggy } : {}),
          ...(redirectStep
            ? { [redirectStep.config.platform]: redirectStep.config.url }
            : {}),
        },
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
  async getPublicLegacyTruform(input: {
    slug: string
    preview?: boolean
  }): Promise<LegacyTruformShape> {
    const survey = await this.findActiveSurveyBySlug(input.slug, {
      allowDraft: !!input.preview,
    })
    if (survey.template !== 'deep') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Slug resolves to a quick-template survey; use getPublicLegacyJourney instead',
      })
    }
    // Hotfix §4 — resolve location branding (same path as journey shim).
    // The truform's existing config.brandColor (per-survey) stays as a
    // last-resort fallback inside the renderer, but the location-level
    // branding now takes precedence.
    const branding = await resolvePublicBranding(
      this.db,
      survey.workspaceId,
      survey.locationId,
    )
    const settings = (survey.settings ?? {}) as {
      type?: 'nps' | 'csat' | 'ces' | 'custom'
      branding?: { brandColor?: string }
      thankYouMessage?: string
    }
    return {
      id: survey.legacyTruformId ?? survey.id,
      name: survey.name,
      type: (settings.type ?? 'csat') as 'nps' | 'csat' | 'ces' | 'custom',
      branding,
      config: {
        brandColor: settings.branding?.brandColor ?? '#6366f1',
        thankYouMessage:
          settings.thankYouMessage ?? 'Thank you for your feedback!',
      },
    }
  }

  /**
   * Journey A Step 3a.1 — AI review draft.
   *
   * When the customer clicks YES on the happy prompt, the FE calls this
   * endpoint to fetch an AI-composed positive review tailored to the
   * business + the score the customer just gave. The FE then writes the
   * returned text to the clipboard and opens the redirect URL so the
   * customer can paste on Google / Zomato / Swiggy / etc.
   *
   * The happy YES path is TERMINAL for Journey A — see
   * obsidian/concepts/Customer-Journeys.md. Whatever the customer does on
   * the external platform is observed asynchronously via Connectors
   * polling (Journey E loopback), not from this endpoint.
   *
   * Falls back to a static template when OPENROUTER_API_KEY is unset or
   * the AI call fails, so the happy path never strands the customer with
   * an empty clipboard.
   */
  async generateHappyReviewDraft(input: {
    journeyId: string
    metricShown?: SurveyMetric
    metricScore?: number
  }): Promise<{ text: string; source: 'ai' | 'fallback' }> {
    const survey = await this.findSurveyById(input.journeyId)
    const branding = await resolvePublicBranding(
      this.db,
      survey.workspaceId,
      survey.locationId,
    )
    const businessName = branding.workspaceName || 'this business'
    // Branding-Resolution composes displayName as "Workspace — Location"
    // when both differ. Strip out the location half for the prompt so
    // the AI mentions the specific place, not the parent workspace alias.
    const displayParts = branding.displayName?.split(' — ') ?? []
    const locationName =
      displayParts.length > 1
        ? displayParts[displayParts.length - 1]!.trim()
        : ''
    const fullName = locationName
      ? `${businessName} — ${locationName}`
      : businessName

    // Static fallback used when OpenRouter is unconfigured or fails.
    const fallback = `Had a great experience at ${fullName}!`

    if (!process.env.OPENROUTER_API_KEY) {
      return { text: fallback, source: 'fallback' }
    }

    try {
      const systemPrompt = `You write short, authentic-sounding positive reviews for small businesses. The customer just rated their experience highly and wants to post the review on Google / Zomato / Swiggy.

Rules:
- 1-2 sentences. Never longer.
- Sound like a real customer, NOT an AI. Avoid "amazing experience", "highly recommend", "five stars", "would definitely recommend".
- Casual, specific, natural. Use contractions.
- Mention the business name naturally (once, not in every sentence).
- NO sign-off. NO emoji.
- Vary structure across runs.`

      const scoreLine =
        input.metricShown && input.metricScore !== undefined
          ? `\nCustomer signal: ${input.metricShown.toUpperCase()} = ${input.metricScore} (positive)`
          : ''

      const userPrompt = `Business: ${fullName}${scoreLine}\n\nWrite the review (just the review text, nothing else):`

      const completion = await openrouter.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 120,
        temperature: 0.9,
      })

      const aiText = completion.choices[0]?.message?.content?.trim()
      if (aiText) {
        return { text: aiText, source: 'ai' }
      }
    } catch (err: any) {
      this.logger.warn(
        `Happy review draft generation failed: ${err?.message ?? err}`,
      )
    }

    return { text: fallback, source: 'fallback' }
  }
}

export interface LegacyJourneyShape {
  id: string
  slug: string
  name: string
  locationId: string | null
  settings: { reviewPlatform: 'google' | 'zomato' | 'swiggy' }
  /**
   * Hotfix §4 — resolved branding (location → workspace → defaults).
   * Renderer reads once on mount and holds in state across the whole
   * customer flow.
   */
  branding: PublicBranding
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
  /**
   * Hotfix §4 — resolved branding (location → workspace → defaults).
   * Takes precedence over `config.brandColor` (per-survey) at the
   * renderer level. The legacy `config.brandColor` is preserved for
   * pre-§4 surveys' fallback rendering.
   */
  branding: PublicBranding
  config: {
    brandColor: string
    thankYouMessage: string
  }
}

// ─── Public response shapes ──────────────────────────────────────────────

export interface InitialStateResponse {
  surveyId: string
  sessionId: string
  template: 'quick' | 'deep' | 'adaptive' | 'custom'
  step: SurveyStep
  metricShown?: SurveyMetric
  businessName: string
  // Path B — resolved branding (location → workspace → defaults) so the
  // step-walker renderer can paint the branded layout immediately.
  branding: PublicBranding
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
