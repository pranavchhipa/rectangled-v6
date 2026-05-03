import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
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
  type SurveyMetric,
  type PublicBranding,
  isPositive as isPositiveScore,
  isScoreInRange,
  pickRandomMetric,
  METRIC_DEFAULT_THRESHOLDS,
} from '@rectangled/shared'
import { resolvePublicBranding } from './branding.helper'

/**
 * Hotfix PRD §2 — Adaptive Customer Journey engine.
 *
 * Implements the v2 spec verbatim (see PRD_Adaptive_Customer_Journey_v2.md
 * §3 for the locked customer flow):
 *
 *   1. Customer scans QR → /j/{slug} loads
 *   2. Server picks ONE metric uniformly at random from
 *      survey.settings.enabledMetrics (no session stickiness — same
 *      visitor on a refresh may get a different metric)
 *   3. Customer answers
 *   4. Score is evaluated against the per-metric threshold
 *      (CSAT≥4, NPS≥9, CES≤3 inverted, NEV≥0, CLI≥5)
 *   5. Happy path → "Will you leave a review on {platform}?" Yes/No
 *   6. Unhappy path → aspect tag pills + optional text → optional contact
 *   7. Store response, fire automation events, end
 *
 * This engine deliberately ignores `survey.steps`. The step graph is
 * preserved for rollback safety (flip template back to 'quick' and the
 * step-based engine takes over) but is not the source of truth at
 * runtime.
 *
 * Threshold leak prevention (PRD §6.2): the public-facing payload
 * NEVER includes the threshold. Score validation happens server-side.
 *
 * The engine is wired by `SurveyEngineService` — when survey.template
 * === 'adaptive' the public endpoints delegate here. Other templates
 * (quick / deep / custom) keep using the step-based engine.
 */
@Injectable()
export class AdaptiveEngineService {
  private readonly logger = new Logger(AdaptiveEngineService.name)
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // ─── Public surface ──────────────────────────────────────────────────

  /**
   * First visit. Picks a metric, inserts an idempotent survey_starts
   * row, returns the metric question + customer-facing copy. Threshold
   * is NOT included in the response.
   */
  async getInitialState(input: {
    slug: string
    sessionId?: string
    /**
     * Hotfix-2 — preview mode bypasses the active-status filter so the
     * editor's Preview button can walk draft adaptive journeys.
     */
    preview?: boolean
  }): Promise<AdaptiveInitialState> {
    const survey = await this.findActiveBySlug(input.slug, {
      allowDraft: !!input.preview,
    })
    const settings = (survey.settings ?? {}) as AdaptiveSettings

    const enabled = (settings.enabledMetrics ?? []).filter(isMetric)
    if (enabled.length === 0) {
      // Per v2 PRD §3.2 — empty enabledMetrics is invalid, return 404.
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Survey has no enabled metrics',
      })
    }

    const metricShown = pickRandomMetric(enabled as SurveyMetric[])
    const sessionId = input.sessionId ?? randomUUID()

    // Idempotent survey_starts (UNIQUE(survey_id, session_id)).
    await this.db
      .insert(surveyStarts)
      .values({ surveyId: survey.id, sessionId, metadata: {} })
      .onConflictDoNothing()

    // Hotfix §4 — branding resolution (location → workspace → defaults).
    // The previous `resolveBusinessName` is subsumed by branding;
    // workspaceName from the resolved object plays the same role for
    // the {businessName} interpolation token below.
    const branding = await resolvePublicBranding(
      this.db,
      survey.workspaceId,
      survey.locationId,
    )
    const businessName = branding.workspaceName

    const platform =
      (settings.reviewPlatform as 'google' | 'zomato' | 'swiggy') ?? 'google'

    return {
      surveyId: survey.id,
      sessionId,
      template: 'adaptive',
      businessName,
      branding,
      // The threshold is intentionally absent. Do not add it.
      question: this.questionFor(metricShown, settings),
      scaleLabels: this.scaleLabelsFor(metricShown, settings),
      metricShown,
      reviewPlatform: platform,
      // The redirect link for THIS platform only — never expose the full
      // map. May be empty string when the owner hasn't set it (the
      // settings UI surfaces a banner in that case).
      redirectUrl: this.redirectUrlFor(platform, settings),
      reviewPromptCopy: settings.reviewPromptCopy ?? {
        question: `Would you mind leaving us a review on ${platform[0].toUpperCase() + platform.slice(1)}?`,
        yesLabel: 'Sure',
        noLabel: 'Maybe later',
      },
      reviewTemplate: this.interpolateReviewTemplate(
        settings.reviewTemplate ?? `Had a great experience at {businessName}!`,
        { businessName, metricShown, score: undefined },
      ),
      aspectTags: settings.aspectTags ?? [
        'Service',
        'Quality',
        'Cleanliness',
        'Wait time',
        'Value',
        'Staff',
      ],
      feedbackPlaceholder:
        settings.feedbackPlaceholder ??
        'Tell us what went wrong, in your own words.',
      thankYouHappyYes:
        settings.thankYouHappyYes ?? 'Thank you! Opening the review page now.',
      thankYouHappyNo: settings.thankYouHappyNo ?? 'Thanks for your time!',
      thankYouUnhappy:
        settings.thankYouUnhappy ??
        "Thank you for the feedback. We'll work on it.",
    }
  }

  /**
   * PHASE 1 — first submit. Customer answered the metric. Returns the
   * computed isPositive so the renderer knows which follow-up screen
   * to show. Inserts a survey_responses row with the metric data.
   *
   * Mirrors the legacy submitLegacyJourney input shape exactly so the
   * existing /j/{slug} renderer works unchanged.
   */
  async submitMetric(input: {
    surveyId: string
    sessionId: string
    metricShown: SurveyMetric
    metricScore: number
    locationId?: string
  }): Promise<{
    success: true
    responseId: string
    isPositive: boolean | null
  }> {
    const survey = await this.findById(input.surveyId)
    if (survey.template !== 'adaptive') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'AdaptiveEngineService.submitMetric called on non-adaptive survey',
      })
    }
    if (!isMetric(input.metricShown)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown metric: ${input.metricShown}`,
      })
    }
    // Score range validation — v2 PRD §6.3 #2: reject out-of-range, no
    // silent clamping.
    if (
      typeof input.metricScore !== 'number' ||
      !isScoreInRange(input.metricShown, input.metricScore)
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Score out of range for metric ${input.metricShown}`,
      })
    }

    const settings = (survey.settings ?? {}) as AdaptiveSettings
    const isPos = this.computeIsPositive(
      input.metricShown,
      input.metricScore,
      settings,
    )

    // Mirror metricScore into the per-metric field for analytics
    // back-compat (PRD §5.4 — the canonical fields are metricShown +
    // metricScore but per-metric *Score keys are double-written).
    const responseData: Record<string, unknown> = {
      metricShown: input.metricShown,
      metricScore: input.metricScore,
      [`${input.metricShown}Score`]: input.metricScore,
    }

    // Idempotent start row in case the renderer skipped getInitialState.
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
        sessionId: input.sessionId,
        responseData,
        metricShown: input.metricShown,
        metricScore: input.metricScore,
        isPositive: isPos,
        score: input.metricScore,
        answers: {},
        // Mark complete on PHASE 1 so analytics see the score. PHASE 2
        // re-stamps completedAt when contact / yes-no comes in.
        completedAt: new Date(),
        metadata: {},
      })
      .returning()

    return { success: true, responseId: response.id, isPositive: isPos }
  }

  /**
   * PHASE 2 — follow-up submit. Either:
   *   (a) Happy path: { acceptedReviewPrompt, redirectedTo } — no contact
   *   (b) Unhappy path: { aspectTags, feedback, name?, email?, phone? }
   *
   * Merges into the existing survey_responses row, upserts a customer if
   * contact info present, creates an offline review on unhappy
   * completion (PRD §6.3 #7).
   */
  async submitFollowup(input: {
    surveyId: string
    sessionId: string
    responseId: string
    patch: {
      // Happy
      acceptedReviewPrompt?: boolean
      redirectedTo?: 'google' | 'zomato' | 'swiggy'
      // Unhappy
      aspectTags?: string[]
      feedback?: string
      name?: string
      email?: string
      phone?: string
    }
    locationId?: string
  }): Promise<{
    success: true
    responseId: string
    isPositive: boolean | null
    customerId: string | null
  }> {
    const survey = await this.findById(input.surveyId)
    if (survey.template !== 'adaptive') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'AdaptiveEngineService.submitFollowup on non-adaptive survey',
      })
    }
    const existing = await this.db.query.surveyResponses.findFirst({
      where: and(
        eq(surveyResponses.id, input.responseId),
        eq(surveyResponses.surveyId, survey.id),
      ),
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Response not found' })
    }

    // ─── Customer upsert (mirror submitLegacyTruform's pattern: phone
    // first, then email, scoped to workspace, lookup-then-insert).
    let customerId = existing.customerId ?? null
    const { name, email, phone } = input.patch
    if (!customerId && (name || email || phone)) {
      let lookup: typeof customers.$inferSelect | undefined
      if (phone) {
        lookup = await this.db.query.customers.findFirst({
          where: and(
            eq(customers.workspaceId, survey.workspaceId),
            eq(customers.phone, phone),
          ),
        })
      }
      if (!lookup && email) {
        lookup = await this.db.query.customers.findFirst({
          where: and(
            eq(customers.workspaceId, survey.workspaceId),
            eq(customers.email, email),
          ),
        })
      }
      if (lookup) {
        customerId = lookup.id
        const fieldPatch: Partial<typeof customers.$inferInsert> = {}
        if (!lookup.name && name) fieldPatch.name = name
        if (!lookup.email && email) fieldPatch.email = email
        if (!lookup.phone && phone) fieldPatch.phone = phone
        if (Object.keys(fieldPatch).length > 0) {
          await this.db
            .update(customers)
            .set({ ...fieldPatch, lastSeenAt: new Date() })
            .where(eq(customers.id, lookup.id))
        }
      } else {
        const [created] = await this.db
          .insert(customers)
          .values({
            workspaceId: survey.workspaceId,
            name: name ?? null,
            email: email ?? null,
            phone: phone ?? null,
          })
          .returning()
        customerId = created?.id ?? null
      }
    }

    const merged: Record<string, unknown> = {
      ...((existing.responseData ?? {}) as Record<string, unknown>),
    }
    if (input.patch.acceptedReviewPrompt !== undefined)
      merged.acceptedReviewPrompt = input.patch.acceptedReviewPrompt
    if (input.patch.redirectedTo)
      merged.redirectedTo = input.patch.redirectedTo
    if (input.patch.aspectTags) merged.aspectTags = input.patch.aspectTags
    if (input.patch.feedback) merged.feedback = input.patch.feedback
    if (name) merged.name = name
    if (email) merged.email = email
    if (phone) merged.phone = phone

    const [updated] = await this.db
      .update(surveyResponses)
      .set({
        responseData: merged,
        customerId: customerId ?? existing.customerId,
        completedAt: new Date(),
      })
      .where(eq(surveyResponses.id, existing.id))
      .returning()

    // ─── Offline review on unhappy completion (PRD §6.3 #7) ─────────
    if (existing.isPositive === false) {
      const aspectTags = input.patch.aspectTags ?? null
      await this.db
        .insert(reviews)
        .values({
          workspaceId: survey.workspaceId,
          locationId:
            existing.locationId ?? input.locationId ?? survey.locationId ?? null,
          platform: 'offline' as any,
          platformReviewId: `offline-${existing.id}`,
          reviewerName: name || 'Anonymous',
          rating: 2, // unhappy — fixed low rating per offline-review contract
          text: input.patch.feedback ?? null,
          reviewedAt: new Date(),
          source: 'offline' as any,
          aspectTags,
          customerId: customerId ?? null,
          metadata: {
            metricShown: existing.metricShown,
            metricScore: existing.metricScore,
            surveyResponseId: existing.id,
          } as any,
        })
        .onConflictDoNothing()
    }

    // Mark start row complete (closes funnel-analytics gap).
    await this.db
      .update(surveyStarts)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(surveyStarts.surveyId, survey.id),
          eq(surveyStarts.sessionId, input.sessionId),
        ),
      )

    return {
      success: true,
      responseId: updated.id,
      isPositive: existing.isPositive,
      customerId,
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  /**
   * Computes is_positive using the per-metric threshold from
   * survey.settings.thresholds (or METRIC_DEFAULT_THRESHOLDS as
   * fallback). Returns null if the metric or score is invalid — but
   * the validation in submitMetric should prevent that path.
   */
  private computeIsPositive(
    metric: SurveyMetric,
    score: number,
    settings: AdaptiveSettings,
  ): boolean | null {
    const threshold =
      settings.thresholds?.[metric] ?? METRIC_DEFAULT_THRESHOLDS[metric]
    if (threshold == null) return null
    return isPositiveScore(metric, score, threshold)
  }

  private async findActiveBySlug(
    slug: string,
    options: { allowDraft?: boolean } = {},
  ) {
    const where = options.allowDraft
      ? eq(surveys.slug, slug)
      : and(eq(surveys.slug, slug), eq(surveys.status, 'active'))
    const survey = await this.db.query.surveys.findFirst({ where })
    if (!survey || survey.archivedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' })
    }
    return survey
  }

  private async findById(id: string) {
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

  private questionFor(metric: SurveyMetric, settings: AdaptiveSettings): string {
    return (
      settings.metricCopy?.[metric]?.question ??
      DEFAULT_METRIC_QUESTIONS[metric]
    )
  }

  private scaleLabelsFor(
    metric: SurveyMetric,
    settings: AdaptiveSettings,
  ): { low: string; high: string } {
    return (
      settings.metricCopy?.[metric]?.scaleLabels ??
      DEFAULT_SCALE_LABELS[metric]
    )
  }

  private redirectUrlFor(
    platform: 'google' | 'zomato' | 'swiggy',
    settings: AdaptiveSettings,
  ): string {
    return settings.redirectLinks?.[platform] ?? ''
  }

  private interpolateReviewTemplate(
    template: string,
    vars: { businessName: string; metricShown: SurveyMetric; score?: number },
  ): string {
    return template
      .replaceAll('{businessName}', vars.businessName)
      .replaceAll('{metricName}', vars.metricShown.toUpperCase())
      .replaceAll(
        '{score}',
        vars.score === undefined ? '' : String(vars.score),
      )
  }
}

// ─── Types ─────────────────────────────────────────────────────────────

function isMetric(value: unknown): value is SurveyMetric {
  return (
    value === 'csat' ||
    value === 'nps' ||
    value === 'ces' ||
    value === 'nev' ||
    value === 'cli'
  )
}

interface AdaptiveSettings {
  enabledMetrics?: SurveyMetric[]
  thresholds?: Partial<Record<SurveyMetric, number>>
  reviewPlatform?: 'google' | 'zomato' | 'swiggy'
  redirectLinks?: Partial<Record<'google' | 'zomato' | 'swiggy', string>>
  reviewTemplate?: string
  reviewPromptCopy?: { question: string; yesLabel: string; noLabel: string }
  metricCopy?: Partial<
    Record<SurveyMetric, { question: string; scaleLabels: { low: string; high: string } }>
  >
  aspectTags?: string[]
  feedbackPlaceholder?: string
  thankYouHappyYes?: string
  thankYouHappyNo?: string
  thankYouUnhappy?: string
  enableCoupon?: boolean
  couponTemplateId?: string
  collectContact?: boolean
  collectContactRequired?: boolean
}

export interface AdaptiveInitialState {
  surveyId: string
  sessionId: string
  template: 'adaptive'
  /** Workspace name. Used for `{businessName}` interpolation in copy. Same as `branding.workspaceName`. */
  businessName: string
  /**
   * Hotfix §4 — full branding payload (location → workspace → defaults
   * + white-label tagline). The `/j/{slug}` renderer renders the
   * branded header from this; the legacy shape returned by
   * `SurveyEngineService.getPublicLegacyJourney` also includes branding
   * via the same helper.
   */
  branding: PublicBranding
  metricShown: SurveyMetric
  question: string
  scaleLabels: { low: string; high: string }
  reviewPlatform: 'google' | 'zomato' | 'swiggy'
  redirectUrl: string
  reviewPromptCopy: { question: string; yesLabel: string; noLabel: string }
  reviewTemplate: string
  aspectTags: string[]
  feedbackPlaceholder: string
  thankYouHappyYes: string
  thankYouHappyNo: string
  thankYouUnhappy: string
  // NB: NO threshold field. NEVER add one. The threshold check
  // happens server-side at submitMetric time. v2 PRD §6.2.
}

const DEFAULT_METRIC_QUESTIONS: Record<SurveyMetric, string> = {
  csat: 'How satisfied are you with your experience?',
  nps: 'How likely are you to recommend us to a friend?',
  ces: 'How easy was it to get what you needed today?',
  nev: 'How did your experience make you feel?',
  cli: 'How likely are you to keep choosing us in the future?',
}

const DEFAULT_SCALE_LABELS: Record<
  SurveyMetric,
  { low: string; high: string }
> = {
  csat: { low: 'Very unsatisfied', high: 'Very satisfied' },
  nps: { low: 'Not at all likely', high: 'Extremely likely' },
  ces: { low: 'Very easy', high: 'Very difficult' },
  nev: { low: 'Very negative', high: 'Very positive' },
  cli: { low: 'Not likely at all', high: 'Extremely likely' },
}
