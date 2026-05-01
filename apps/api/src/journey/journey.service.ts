import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, asc, desc, isNull, sql, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import {
  journeys,
  journeyScreens,
  journeyResponses,
  members,
  customers,
  reviews,
  connectorInstances,
  workspaces,
  locations,
} from '@rectangled/db'
import {
  type JourneyMetric,
  JOURNEY_METRICS,
  METRIC_DEFAULT_THRESHOLDS,
  DEFAULT_METRIC_QUESTION_CONFIG,
  DEFAULT_JOURNEY_SETTINGS_V2,
  isJourneyMetric,
  isPositive as isPositiveScore,
  isScoreInRange,
  pickRandomMetric,
} from '@rectangled/shared'

type JourneySettings = {
  enabledMetrics: JourneyMetric[]
  thresholds: Record<JourneyMetric, number>
  enableCoupon: boolean
  reviewPlatform: 'google' | 'zomato' | 'swiggy'
}

type MetricQuestionConfig = {
  metricCopy: Record<
    JourneyMetric,
    { question: string; scaleLabels: { low: string; high: string } }
  >
  aspectTags: string[]
  feedbackPlaceholder: string
  reviewPromptCopy: { question: string; yesLabel: string; noLabel: string }
  redirectLinks: { google?: string; zomato?: string; swiggy?: string }
  reviewTemplate: string
  thankYouHappyYes: string
  thankYouHappyNo: string
  thankYouUnhappy: string
}

@Injectable()
export class JourneyService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async list(
    workspaceId: string,
    locationId: string | undefined,
    userId: string,
    includeArchived = false,
  ) {
    await this.requireMembership(workspaceId, userId)
    const conditions = [eq(journeys.workspaceId, workspaceId)]
    if (locationId) conditions.push(eq(journeys.locationId, locationId))
    if (!includeArchived) conditions.push(isNull(journeys.archivedAt))

    return this.db.query.journeys.findMany({
      where: and(...conditions),
      orderBy: [desc(journeys.createdAt)],
      with: { screens: { orderBy: [asc(journeyScreens.order)] } },
    })
  }

  async getById(id: string, userId: string) {
    const journey = await this.findOrThrow(id)
    await this.requireMembership(journey.workspaceId, userId)
    const screens = await this.db.query.journeyScreens.findMany({
      where: eq(journeyScreens.journeyId, id),
      orderBy: [asc(journeyScreens.order)],
    })
    return { ...journey, screens }
  }

  async create(
    input: {
      workspaceId: string
      locationId?: string
      name: string
      settings?: Partial<Omit<JourneySettings, 'thresholds'>> & {
        thresholds?: Partial<Record<JourneyMetric, number>>
      }
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)
    const slug = `j-${randomUUID().slice(0, 10)}`

    const settings: JourneySettings = {
      ...DEFAULT_JOURNEY_SETTINGS_V2,
      ...(input.settings ?? {}),
      thresholds: {
        ...DEFAULT_JOURNEY_SETTINGS_V2.thresholds,
        ...(input.settings?.thresholds ?? {}),
      },
    }

    const [journey] = await this.db
      .insert(journeys)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId,
        name: input.name.trim(),
        slug,
        settings,
      })
      .returning()

    const config = this.buildDefaultMetricQuestionConfig()
    if (input.locationId) {
      const url = await this.lookupGoogleReviewUrl(input.workspaceId, input.locationId)
      if (url) config.redirectLinks.google = url
    }

    await this.db.insert(journeyScreens).values({
      journeyId: journey.id,
      order: 0,
      screenType: 'metric_question' as any,
      title: 'How was your experience?',
      subtitle: null,
      config: config as unknown as Record<string, unknown>,
      branchConditions: [],
    })

    return journey
  }

  async update(
    input: {
      id: string
      name?: string
      locationId?: string | null
      isActive?: boolean
      settings?: Partial<Omit<JourneySettings, 'thresholds'>> & {
        thresholds?: Partial<Record<JourneyMetric, number>>
      }
    },
    userId: string,
  ) {
    const journey = await this.findOrThrow(input.id)
    await this.requireMembership(journey.workspaceId, userId)

    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) setValues.name = input.name.trim()
    if (input.locationId !== undefined) setValues.locationId = input.locationId
    if (input.isActive !== undefined) setValues.isActive = input.isActive
    if (input.settings) {
      const current = journey.settings as JourneySettings
      const merged: JourneySettings = {
        ...current,
        ...input.settings,
        thresholds: { ...current.thresholds, ...(input.settings.thresholds ?? {}) },
      }
      setValues.settings = merged
    }

    const [updated] = await this.db
      .update(journeys)
      .set(setValues)
      .where(eq(journeys.id, input.id))
      .returning()

    if (input.locationId !== undefined && input.locationId !== null) {
      await this.autoFillGoogleReviewUrl(input.id, journey.workspaceId, input.locationId)
    }

    return updated
  }

  private async lookupGoogleReviewUrl(
    workspaceId: string,
    locationId: string,
  ): Promise<string | undefined> {
    const gbpConnector = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.workspaceId, workspaceId),
        eq(connectorInstances.connectorTypeId, 'gbp'),
        eq(connectorInstances.locationId, locationId),
      ),
    })
    const placeId = (gbpConnector?.config as any)?.placeId
    if (!placeId) return undefined
    return `https://search.google.com/local/writereview?placeid=${placeId}`
  }

  /**
   * v2-only: writes the GBP-derived Google review URL into the metric_question
   * screen's `redirectLinks.google` if it's empty.
   */
  private async autoFillGoogleReviewUrl(
    journeyId: string,
    workspaceId: string,
    locationId: string,
  ) {
    const googleUrl = await this.lookupGoogleReviewUrl(workspaceId, locationId)
    if (!googleUrl) return

    const screen = await this.db.query.journeyScreens.findFirst({
      where: and(
        eq(journeyScreens.journeyId, journeyId),
        eq(journeyScreens.screenType, 'metric_question' as any),
      ),
    })
    if (!screen) return

    const config = (screen.config ?? {}) as Record<string, any>
    if (!config.redirectLinks || typeof config.redirectLinks !== 'object') {
      config.redirectLinks = {}
    }
    if (!config.redirectLinks.google) {
      config.redirectLinks.google = googleUrl
      await this.db
        .update(journeyScreens)
        .set({ config })
        .where(eq(journeyScreens.id, screen.id))
    }
  }

  async archive(id: string, userId: string) {
    const journey = await this.findOrThrow(id)
    await this.requireMembership(journey.workspaceId, userId)
    const [updated] = await this.db
      .update(journeys)
      .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(journeys.id, id))
      .returning()
    return updated
  }

  /**
   * v2-only: a journey has exactly one `metric_question` screen. We replace
   * it on save. Inputs are validated upstream (Zod literal type).
   */
  async updateScreens(
    journeyId: string,
    screens: Array<{
      id?: string
      order: number
      screenType: string
      title?: string
      subtitle?: string
      config?: Record<string, unknown>
      branchConditions?: Array<{
        field: string
        operator: string
        value?: unknown
        nextScreenId: string
      }>
    }>,
    userId: string,
  ) {
    const journey = await this.findOrThrow(journeyId)
    await this.requireMembership(journey.workspaceId, userId)

    if (screens.length > 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Journeys may only have one metric_question screen',
      })
    }
    if (screens.some((s) => s.screenType !== 'metric_question')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only metric_question screens are supported in v2',
      })
    }

    let googleUrl: string | undefined
    if (journey.locationId) {
      googleUrl = await this.lookupGoogleReviewUrl(journey.workspaceId, journey.locationId)
    }

    if (googleUrl) {
      for (const s of screens) {
        const config = (s.config || {}) as Record<string, any>
        if (!config.redirectLinks || typeof config.redirectLinks !== 'object') {
          config.redirectLinks = {}
        }
        if (!config.redirectLinks.google) config.redirectLinks.google = googleUrl
        s.config = config
      }
    }

    await this.db.delete(journeyScreens).where(eq(journeyScreens.journeyId, journeyId))
    if (screens.length === 0) return []

    const values = screens.map((s) => ({
      journeyId,
      order: s.order,
      screenType: s.screenType as any,
      title: s.title,
      subtitle: s.subtitle,
      config: s.config || {},
      branchConditions: s.branchConditions || [],
    }))

    const inserted = await this.db.insert(journeyScreens).values(values).returning()
    return inserted
  }

  /**
   * PUBLIC v2: Get journey by slug. Server picks ONE metric uniformly at
   * random from `settings.enabledMetrics` and returns only the copy for that
   * metric. The threshold is NEVER returned — the client doesn't need it.
   */
  async getPublicJourney(slug: string) {
    const journey = await this.db.query.journeys.findFirst({
      where: and(eq(journeys.slug, slug), eq(journeys.isActive, true)),
    })

    if (!journey || journey.archivedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }

    const settings = journey.settings as JourneySettings
    const enabled = (settings.enabledMetrics ?? []).filter(isJourneyMetric) as JourneyMetric[]
    if (enabled.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not configured' })
    }

    const metricShown = pickRandomMetric(enabled)

    const screen = await this.db.query.journeyScreens.findFirst({
      where: and(
        eq(journeyScreens.journeyId, journey.id),
        eq(journeyScreens.screenType, 'metric_question' as any),
      ),
      orderBy: [asc(journeyScreens.order)],
    })

    if (!screen) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not configured' })
    }

    const config = (screen.config ?? {}) as Partial<MetricQuestionConfig>
    const metricCopy = config.metricCopy?.[metricShown]
    if (!metricCopy) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Metric copy missing' })
    }

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, journey.workspaceId),
    })
    let locationName: string | undefined
    if (journey.locationId) {
      const loc = await this.db.query.locations.findFirst({
        where: eq(locations.id, journey.locationId),
      })
      locationName = loc?.name
    }
    const businessName = locationName || workspace?.name || 'us'

    const interpolatedReviewTemplate = (
      config.reviewTemplate ?? 'Had a great experience at {businessName}!'
    )
      .replace(/\{businessName\}/g, businessName)
      .replace(/\{metricName\}/g, metricShown.toUpperCase())

    return {
      id: journey.id,
      slug: journey.slug,
      name: journey.name,
      locationId: journey.locationId,
      settings: {
        reviewPlatform: settings.reviewPlatform ?? 'google',
      },
      screen: {
        id: screen.id,
        metricShown,
        question: metricCopy.question,
        scaleLabels: metricCopy.scaleLabels,
        aspectTags: config.aspectTags ?? [],
        feedbackPlaceholder: config.feedbackPlaceholder ?? '',
        reviewPromptCopy: config.reviewPromptCopy ?? {
          question: 'Would you mind leaving us a review?',
          yesLabel: 'Sure',
          noLabel: 'Maybe later',
        },
        redirectLinks: config.redirectLinks ?? {},
        reviewTemplate: interpolatedReviewTemplate,
        thankYouHappyYes: config.thankYouHappyYes ?? 'Thanks!',
        thankYouHappyNo: config.thankYouHappyNo ?? 'Thanks for your time!',
        thankYouUnhappy: config.thankYouUnhappy ?? 'Thank you for the feedback.',
      },
    }
  }

  /**
   * PUBLIC v2: Submit a journey response.
   *
   * Two-phase submit:
   * - Phase 1 (no `updateResponseId`): customer answered the metric. Server
   *   validates score range, computes `isPositive`, inserts the row, returns
   *   `{ responseId, isPositive }`. No offline review yet.
   * - Phase 2 (with `updateResponseId`): customer completed the follow-up
   *   (happy: Yes/No, unhappy: aspect tags + feedback + contact). Server
   *   merges the new fields. On unhappy completion, an offline review is
   *   created so it shows up in the inbox.
   */
  async submitResponse(input: {
    journeyId: string
    journeyScreenId?: string
    locationId?: string
    sessionId: string
    responseData: Record<string, unknown>
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    updateResponseId?: string
  }) {
    const journey = await this.db.query.journeys.findFirst({
      where: eq(journeys.id, input.journeyId),
    })
    if (!journey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }

    const settings = journey.settings as JourneySettings

    // ===== PHASE 2: merge into existing response =====
    if (input.updateResponseId) {
      const existing = await this.db.query.journeyResponses.findFirst({
        where: and(
          eq(journeyResponses.id, input.updateResponseId),
          eq(journeyResponses.journeyId, input.journeyId),
        ),
      })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Response not found' })
      }

      let customerId = existing.customerId ?? undefined
      if (!customerId && (input.customerName || input.customerEmail || input.customerPhone)) {
        const [customer] = await this.db
          .insert(customers)
          .values({
            workspaceId: journey.workspaceId,
            name: input.customerName,
            email: input.customerEmail,
            phone: input.customerPhone,
          })
          .returning()
        customerId = customer.id
      }

      const mergedResponseData = {
        ...((existing.responseData ?? {}) as Record<string, unknown>),
        ...input.responseData,
      }

      await this.db
        .update(journeyResponses)
        .set({
          responseData: mergedResponseData,
          ...(customerId ? { customerId } : {}),
        })
        .where(eq(journeyResponses.id, input.updateResponseId))

      const metricShown = (mergedResponseData.metricShown as JourneyMetric) || undefined
      const metricScore = mergedResponseData.metricScore as number | undefined
      const isPos = this.computeIsPositive(metricShown, metricScore, settings)

      // Create offline review on unhappy-path completion.
      if (metricShown && metricScore !== undefined && isPos === false) {
        const aspectTags = (mergedResponseData.aspectTags as string[] | undefined) ?? null
        await this.db
          .insert(reviews)
          .values({
            workspaceId: journey.workspaceId,
            locationId: existing.locationId ?? input.locationId ?? null,
            platform: 'offline',
            platformReviewId: `offline-${existing.id}`,
            reviewerName: input.customerName || 'Anonymous',
            // Map metric score onto a 1-5 rating for the reviews table contract.
            // Unhappy responses always render as a low rating.
            rating: 2,
            text: (mergedResponseData.feedback as string) || null,
            reviewedAt: new Date(),
            source: 'offline',
            journeyResponseId: existing.id,
            aspectTags,
            customerId: customerId ?? null,
            metadata: { metricShown, metricScore } as any,
          })
          .onConflictDoNothing()
      }

      return { success: true, responseId: existing.id, isPositive: isPos }
    }

    // ===== PHASE 1: first submit =====
    const data = input.responseData
    const metricShown = data.metricShown as JourneyMetric | undefined
    const metricScore = data.metricScore as number | undefined

    if (!metricShown || !isJourneyMetric(metricShown)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'metricShown is required' })
    }
    if (typeof metricScore !== 'number' || !isScoreInRange(metricShown, metricScore)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Score out of range for metric ${metricShown}`,
      })
    }

    const isPos = this.computeIsPositive(metricShown, metricScore, settings)

    // Mirror metricScore into the per-metric field for analytics back-compat.
    const responseData: Record<string, unknown> = { ...data }
    responseData[`${metricShown}Score`] = metricScore

    let customerId: string | undefined
    if (input.customerName || input.customerEmail || input.customerPhone) {
      const [customer] = await this.db
        .insert(customers)
        .values({
          workspaceId: journey.workspaceId,
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone,
        })
        .returning()
      customerId = customer.id
    }

    const [response] = await this.db
      .insert(journeyResponses)
      .values({
        journeyId: input.journeyId,
        journeyScreenId: input.journeyScreenId,
        locationId: input.locationId,
        sessionId: input.sessionId,
        responseData,
        customerId,
      })
      .returning()

    return { success: true, responseId: response.id, isPositive: isPos }
  }

  private computeIsPositive(
    metric: JourneyMetric | undefined,
    score: number | undefined,
    settings: JourneySettings,
  ): boolean | null {
    if (!metric || score === undefined) return null
    const threshold = settings.thresholds?.[metric] ?? METRIC_DEFAULT_THRESHOLDS[metric]
    return isPositiveScore(metric, score, threshold)
  }

  private buildDefaultMetricQuestionConfig(): MetricQuestionConfig {
    return {
      metricCopy: { ...DEFAULT_METRIC_QUESTION_CONFIG.metricCopy },
      aspectTags: [...DEFAULT_METRIC_QUESTION_CONFIG.aspectTags],
      feedbackPlaceholder: DEFAULT_METRIC_QUESTION_CONFIG.feedbackPlaceholder,
      reviewPromptCopy: { ...DEFAULT_METRIC_QUESTION_CONFIG.reviewPromptCopy },
      redirectLinks: { ...DEFAULT_METRIC_QUESTION_CONFIG.redirectLinks },
      reviewTemplate: DEFAULT_METRIC_QUESTION_CONFIG.reviewTemplate,
      thankYouHappyYes: DEFAULT_METRIC_QUESTION_CONFIG.thankYouHappyYes,
      thankYouHappyNo: DEFAULT_METRIC_QUESTION_CONFIG.thankYouHappyNo,
      thankYouUnhappy: DEFAULT_METRIC_QUESTION_CONFIG.thankYouUnhappy,
    }
  }

  async seedDefault(workspaceId: string, locationId: string | undefined) {
    const slug = `j-${randomUUID().slice(0, 10)}`
    const settings: JourneySettings = {
      ...DEFAULT_JOURNEY_SETTINGS_V2,
      thresholds: { ...DEFAULT_JOURNEY_SETTINGS_V2.thresholds },
    }
    const [journey] = await this.db
      .insert(journeys)
      .values({
        workspaceId,
        locationId,
        name: 'Default Customer Journey',
        slug,
        isDefault: true,
        isActive: true,
        settings,
      })
      .returning()

    const config = this.buildDefaultMetricQuestionConfig()
    if (locationId) {
      const url = await this.lookupGoogleReviewUrl(workspaceId, locationId)
      if (url) config.redirectLinks.google = url
    }

    await this.db.insert(journeyScreens).values({
      journeyId: journey.id,
      order: 0,
      screenType: 'metric_question' as any,
      title: 'How was your experience?',
      subtitle: null,
      config: config as unknown as Record<string, unknown>,
      branchConditions: [],
    })

    return journey
  }

  // ─── Phase 2 Stage F: bulk operations ───────────────────────

  /**
   * Clone a source journey to N target locations. Each clone gets a fresh
   * slug, fresh screen rows (copying the source's `metric_question` config),
   * and is scoped to its target location.
   *
   * Permission model: caller must be a member of the source journey's
   * workspace AND of every target location's workspace. The org membership
   * gate (Phase 1) is the simplest way to enforce this — the caller must
   * have access to all involved locations through a single org.
   */
  async bulkDeploy(
    input: {
      sourceJourneyId: string
      targetLocationIds: string[]
      customizePerLocation?: Array<{
        locationId: string
        name?: string
        settings?: Partial<JourneySettings>
      }>
    },
    userId: string,
  ) {
    if (input.targetLocationIds.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'targetLocationIds must include at least one location',
      })
    }
    if (input.targetLocationIds.length > 100) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Max 100 locations per bulk deploy',
      })
    }

    // Load source journey + verify access via its workspace.
    const source = await this.findOrThrow(input.sourceJourneyId)
    await this.requireMembership(source.workspaceId, userId)

    // Load source's metric_question screen.
    const sourceScreen = await this.db.query.journeyScreens.findFirst({
      where: and(
        eq(journeyScreens.journeyId, source.id),
        eq(journeyScreens.screenType, 'metric_question' as any),
      ),
    })

    // Load every target location with its workspaceId so we can verify
    // membership and create the journey under the correct workspace.
    const wantedLocs = await this.db
      .select({
        id: locations.id,
        workspaceId: locations.workspaceId,
      })
      .from(locations)
      .where(inArray(locations.id, input.targetLocationIds))
    if (wantedLocs.length !== input.targetLocationIds.length) {
      const missing = input.targetLocationIds.filter(
        (id) => !wantedLocs.some((l) => l.id === id),
      )
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Some target locations not found: ${missing.join(', ')}`,
      })
    }

    // Verify caller has membership in every target workspace.
    const uniqueWorkspaceIds = [...new Set(wantedLocs.map((l) => l.workspaceId))]
    for (const wsId of uniqueWorkspaceIds) {
      await this.requireMembership(wsId, userId)
    }

    const customMap = new Map(
      (input.customizePerLocation ?? []).map((c) => [c.locationId, c]),
    )

    const deployedJourneys: Array<{
      locationId: string
      journeyId: string
      slug: string
    }> = []

    for (const loc of wantedLocs) {
      const custom = customMap.get(loc.id)
      const slug = `j-${randomUUID().slice(0, 10)}`

      const settings: JourneySettings = {
        ...DEFAULT_JOURNEY_SETTINGS_V2,
        ...(source.settings as JourneySettings),
        ...(custom?.settings ?? {}),
        thresholds: {
          ...DEFAULT_JOURNEY_SETTINGS_V2.thresholds,
          ...((source.settings as JourneySettings)?.thresholds ?? {}),
          ...(custom?.settings?.thresholds ?? {}),
        },
      }

      const [journey] = await this.db
        .insert(journeys)
        .values({
          workspaceId: loc.workspaceId,
          locationId: loc.id,
          name: custom?.name ?? source.name,
          slug,
          settings,
        })
        .returning()

      // Copy the source's metric_question screen, but auto-fill the per-location
      // GBP review URL (each location has its own).
      const sourceConfig = (sourceScreen?.config ?? {}) as Record<string, any>
      const config = {
        ...this.buildDefaultMetricQuestionConfig(),
        ...sourceConfig,
        // Per-location overrides go in here.
      }
      const url = await this.lookupGoogleReviewUrl(loc.workspaceId, loc.id)
      if (url) {
        config.redirectLinks = {
          ...(config.redirectLinks ?? {}),
          google: url,
        }
      }

      await this.db.insert(journeyScreens).values({
        journeyId: journey.id,
        order: 0,
        screenType: 'metric_question' as any,
        title: sourceScreen?.title ?? 'How was your experience?',
        subtitle: sourceScreen?.subtitle ?? null,
        config: config as Record<string, unknown>,
        branchConditions: [],
      })

      deployedJourneys.push({
        locationId: loc.id,
        journeyId: journey.id,
        slug,
      })
    }

    return { deployedJourneys }
  }

  /**
   * Look up a set of journeys' slugs in one round-trip. Frontend uses this
   * with the QR-generation API to build a print pack.
   */
  async getBulkSlugs(input: { journeyIds: string[] }, userId: string) {
    if (input.journeyIds.length === 0) return []
    if (input.journeyIds.length > 200) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Max 200 journey IDs per call' })
    }

    const wanted = await this.db
      .select({
        id: journeys.id,
        slug: journeys.slug,
        name: journeys.name,
        workspaceId: journeys.workspaceId,
        locationId: journeys.locationId,
      })
      .from(journeys)
      .where(inArray(journeys.id, input.journeyIds))

    // Verify membership for every distinct workspace involved.
    const distinctWs = [...new Set(wanted.map((r) => r.workspaceId))]
    for (const wsId of distinctWs) {
      await this.requireMembership(wsId, userId)
    }

    return wanted.map((r) => ({
      journeyId: r.id,
      slug: r.slug,
      name: r.name,
      locationId: r.locationId,
    }))
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

  private async findOrThrow(id: string) {
    const journey = await this.db.query.journeys.findFirst({
      where: eq(journeys.id, id),
    })
    if (!journey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }
    return journey
  }
}

export { JOURNEY_METRICS }
