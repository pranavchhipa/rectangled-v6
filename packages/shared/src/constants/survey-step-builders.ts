/**
 * Phase 3 — generators for the pre-built "Intelligent" mode step graphs.
 *
 * Two builders:
 *   buildQuickIntelligentSteps(...)   → mirrors today's Journey v2
 *   buildDeepIntelligentSteps(type)   → mirrors today's TruForm of given type
 *
 * Both return a `SurveyStep[]` ready to drop into `surveys.steps`. Pure —
 * no DB calls. Used by:
 *   - the migration (Stage B) to backfill from journeys/truforms
 *   - the survey CRUD service when an owner picks Intelligent mode
 *   - tests
 */

import type {
  SurveyStep,
  SurveyMetric,
  EndJourneyStep,
} from '../types/survey-steps'
import {
  DEFAULT_METRIC_COPY,
  INVERTED_METRICS,
  type JourneyMetric,
} from './journey-metrics'
import type { WizardAnswers } from '../validators/survey-wizard'

/**
 * Default Quick / Intelligent graph. Same product behaviour as Journey v2:
 * random metric → branch by score → happy path (review redirect) /
 * unhappy path (aspect tags + contact) → terminal.
 */
export function buildQuickIntelligentSteps(opts?: {
  enabledMetrics?: SurveyMetric[]
  reviewPlatform?: 'google' | 'zomato' | 'swiggy'
  redirectUrl?: string
  reviewTemplate?: string
  aspectTags?: string[]
  thankYouHappyYes?: string
  thankYouHappyNo?: string
  thankYouUnhappy?: string
}): SurveyStep[] {
  const enabledMetricsForRandom =
    opts?.enabledMetrics ?? (['csat', 'nps', 'ces', 'nev', 'cli'] as SurveyMetric[])
  const reviewPlatform = opts?.reviewPlatform ?? 'google'
  const redirectUrl = opts?.redirectUrl ?? ''
  const reviewTemplate =
    opts?.reviewTemplate ?? 'Had a great experience at {businessName}!'
  const aspectTags = opts?.aspectTags ?? [
    'Food quality',
    'Service',
    'Cleanliness',
    'Wait time',
    'Value',
    'Staff',
  ]
  const thanksYes = opts?.thankYouHappyYes ?? 'Thank you! Opening the review page now.'
  const thanksNo = opts?.thankYouHappyNo ?? 'Thanks for your time!'
  const thanksUnhappy =
    opts?.thankYouUnhappy ?? "Thank you for the feedback. We'll work on it."

  return [
    {
      id: 's1_metric',
      type: 'ask_metric',
      position: { x: 0, y: 0 },
      config: {
        metric: 'random',
        enabledMetricsForRandom,
        question: 'How was your experience?',
        onComplete: { nextStepId: 's2_branch' },
      },
    },
    {
      id: 's2_branch',
      type: 'branch_by_score',
      position: { x: 0, y: 200 },
      config: {
        metricFromStepId: 's1_metric',
        branches: [
          {
            // 'threshold' is a sentinel — the engine resolves it against the
            // survey's settings.thresholds[metricShown] at runtime.
            condition: { op: 'gte', value: 'threshold' },
            nextStepId: 's3_happy',
            label: 'happy',
          },
        ],
        defaultNextStepId: 's3_unhappy',
      },
    },
    {
      id: 's3_happy',
      type: 'redirect',
      position: { x: -240, y: 400 },
      config: {
        platform: reviewPlatform,
        url: redirectUrl,
        reviewTemplate,
        yesLabel: 'Sure',
        noLabel: 'Maybe later',
        onYesNextStepId: 's4_thanks_yes',
        onNoNextStepId: 's4_thanks_no',
      },
    },
    {
      id: 's4_thanks_yes',
      type: 'end_journey',
      position: { x: -360, y: 600 },
      config: { message: thanksYes, triggerEvent: 'journey_completed_positive' },
    },
    {
      id: 's4_thanks_no',
      type: 'end_journey',
      position: { x: -120, y: 600 },
      config: { message: thanksNo, triggerEvent: 'journey_completed_positive' },
    },
    {
      id: 's3_unhappy',
      type: 'ask_question',
      position: { x: 240, y: 400 },
      config: {
        fieldType: 'multi_select',
        question: 'What went wrong?',
        options: aspectTags,
        required: false,
        onComplete: { nextStepId: 's3b_unhappy_contact' },
      },
    },
    {
      id: 's3b_unhappy_contact',
      type: 'collect_contact',
      position: { x: 240, y: 600 },
      config: {
        fields: [
          { key: 'name', required: false },
          { key: 'email', required: false },
          { key: 'phone', required: false },
        ],
        privacyNote: 'We will only use this to follow up about your feedback.',
        nextStepId: 's4_thanks_unhappy',
      },
    },
    {
      id: 's4_thanks_unhappy',
      type: 'end_journey',
      position: { x: 240, y: 800 },
      config: { message: thanksUnhappy, triggerEvent: 'journey_completed_negative' },
    },
  ]
}

/**
 * Deep / Intelligent step graph for the given TruForm type.
 *
 * NPS    → 0-10 metric, branches: detractor (≤6) / passive / promoter (≥9),
 *          each goes to a free-text follow-up, then optional contact, end.
 * CSAT   → 1-5 metric, simple ask + optional textarea + contact + end.
 * CES    → 1-7 metric, simple ask + textarea on high-effort + contact + end.
 * custom → just an end_journey (owner builds via Builder mode).
 */
export function buildDeepIntelligentSteps(
  type: 'nps' | 'csat' | 'ces' | 'custom',
  opts?: { thankYouMessage?: string },
): SurveyStep[] {
  const message = opts?.thankYouMessage ?? 'Thanks for your feedback!'

  if (type === 'custom') {
    return [
      {
        id: 's_end',
        type: 'end_journey',
        position: { x: 0, y: 0 },
        config: { message },
      },
    ]
  }

  if (type === 'nps') {
    return [
      {
        id: 's1_nps',
        type: 'ask_metric',
        position: { x: 0, y: 0 },
        config: {
          metric: 'nps',
          question: 'How likely are you to recommend us?',
          scaleLabels: { low: 'Not at all likely', high: 'Extremely likely' },
          onComplete: { nextStepId: 's2_branch' },
        },
      },
      {
        id: 's2_branch',
        type: 'branch_by_score',
        position: { x: 0, y: 200 },
        config: {
          metricFromStepId: 's1_nps',
          branches: [
            { condition: { op: 'lte', value: 6 }, nextStepId: 's3_detractor', label: 'detractor' },
            { condition: { op: 'gte', value: 9 }, nextStepId: 's3_promoter', label: 'promoter' },
          ],
          defaultNextStepId: 's3_passive',
        },
      },
      {
        id: 's3_detractor',
        type: 'ask_question',
        position: { x: -300, y: 400 },
        config: {
          fieldType: 'textarea',
          question: 'What can we do better?',
          required: true,
          onComplete: { nextStepId: 's4_contact' },
        },
      },
      {
        id: 's3_passive',
        type: 'show_message',
        position: { x: 0, y: 400 },
        config: {
          title: 'Thanks for your feedback',
          body: 'Your input helps us improve.',
          nextStepId: 's4_contact',
        },
      },
      {
        id: 's3_promoter',
        type: 'ask_question',
        position: { x: 300, y: 400 },
        config: {
          fieldType: 'textarea',
          question: 'What did you love most?',
          required: false,
          onComplete: { nextStepId: 's4_contact' },
        },
      },
      {
        id: 's4_contact',
        type: 'collect_contact',
        position: { x: 0, y: 600 },
        config: {
          fields: [
            { key: 'name', required: false },
            { key: 'email', required: false },
            { key: 'phone', required: false },
          ],
          nextStepId: 's5_end',
        },
      },
      {
        id: 's5_end',
        type: 'end_journey',
        position: { x: 0, y: 800 },
        config: { message },
      },
    ]
  }

  if (type === 'csat') {
    return [
      {
        id: 's1_csat',
        type: 'ask_metric',
        position: { x: 0, y: 0 },
        config: {
          metric: 'csat',
          question: 'How satisfied are you with your experience?',
          scaleLabels: { low: 'Very unsatisfied', high: 'Very satisfied' },
          onComplete: { nextStepId: 's2_followup' },
        },
      },
      {
        id: 's2_followup',
        type: 'ask_question',
        position: { x: 0, y: 200 },
        config: {
          fieldType: 'textarea',
          question: 'Tell us more (optional).',
          required: false,
          onComplete: { nextStepId: 's3_contact' },
        },
      },
      {
        id: 's3_contact',
        type: 'collect_contact',
        position: { x: 0, y: 400 },
        config: {
          fields: [
            { key: 'name', required: false },
            { key: 'email', required: false },
            { key: 'phone', required: false },
          ],
          nextStepId: 's4_end',
        },
      },
      {
        id: 's4_end',
        type: 'end_journey',
        position: { x: 0, y: 600 },
        config: { message },
      },
    ]
  }

  // ces
  return [
    {
      id: 's1_ces',
      type: 'ask_metric',
      position: { x: 0, y: 0 },
      config: {
        metric: 'ces',
        question: 'How easy was it to get what you needed today?',
        scaleLabels: { low: 'Very easy', high: 'Very difficult' },
        onComplete: { nextStepId: 's2_branch' },
      },
    },
    {
      id: 's2_branch',
      type: 'branch_by_score',
      position: { x: 0, y: 200 },
      config: {
        metricFromStepId: 's1_ces',
        branches: [
          // CES is inverted: HIGHER score = harder. >= 5 means a hard experience.
          { condition: { op: 'gte', value: 5 }, nextStepId: 's3_high_effort', label: 'hard' },
        ],
        defaultNextStepId: 's3_easy',
      },
    },
    {
      id: 's3_high_effort',
      type: 'ask_question',
      position: { x: -200, y: 400 },
      config: {
        fieldType: 'textarea',
        question: 'What got in the way?',
        required: false,
        onComplete: { nextStepId: 's4_contact' },
      },
    },
    {
      id: 's3_easy',
      type: 'show_message',
      position: { x: 200, y: 400 },
      config: {
        title: 'Thanks!',
        body: 'Glad it was easy. Anything else to share?',
        nextStepId: 's4_contact',
      },
    },
    {
      id: 's4_contact',
      type: 'collect_contact',
      position: { x: 0, y: 600 },
      config: {
        fields: [
          { key: 'name', required: false },
          { key: 'email', required: false },
          { key: 'phone', required: false },
        ],
        nextStepId: 's5_end',
      },
    },
    {
      id: 's5_end',
      type: 'end_journey',
      position: { x: 0, y: 800 },
      config: { message },
    },
  ]
}

// ─── Hotfix PRD §3 — Wizard Custom Journey Builder ──────────────────────
//
// `buildCustomStepsFromWizard(answers, opts?)` deterministically maps the
// 4-question wizard's answers (validators/survey-wizard.ts) to a step
// graph. The decision-tree editor (PR 2) renders this graph; the engine
// runs it at /j/{slug} unchanged from quick/deep.
//
// Wizard's metric='random' is intercepted by the caller before this
// helper is called — that path creates a `template='adaptive'` survey
// via §2's existing flow. This helper throws if it sees 'random'.
//
// Scope choices (per user direction during PR 1 design):
//   - CES uses op='lte' (inverted); csat/nps use 'gte'. Source of truth
//     is INVERTED_METRICS in journey-metrics.ts — not duplicated here.
//   - Negative chain order: aspects → feedback → contact → end. Low-
//     effort taps first, sensitive contact last (customer warmed up).
//   - Default aspect tags reuse the 6 from buildQuickIntelligentSteps.
//   - issueCoupon templateId is owner-supplied (wizard surfaces a
//     dropdown when the workspace has 2+ templates; auto-fills with 1;
//     disables the checkbox with 0).
//
// Step IDs are intentionally deterministic so the decision-tree editor
// can locate steps by ID without re-walking the graph.

const CUSTOM_STEP_IDS = {
  metric: 's1_metric',
  branch: 's2_branch',
  positiveRedirect: 's3_positive',
  positiveYes: 's_end_positive_yes',
  positiveNo: 's_end_positive_no',
  positiveThanks: 's_end_positive_thanks',
  negativeAspects: 's3_negative_aspects',
  negativeFeedback: 's_negative_feedback',
  contact: 's4_contact',
  endNegative: 's_end_negative',
} as const

const DEFAULT_CUSTOM_ASPECT_TAGS = [
  'Food quality',
  'Service',
  'Cleanliness',
  'Wait time',
  'Value',
  'Staff',
] as const

export interface BuildCustomStepsOptions {
  /** Multi-select options for the negative-aspects question. Defaults to the 6 from buildQuickIntelligentSteps. */
  aspectTags?: string[]
  /** Initial review-redirect URL — empty allowed; owner edits in the decision-tree editor. */
  redirectUrl?: string
  reviewTemplate?: string
  metricQuestion?: string
  feedbackQuestion?: string
  privacyNote?: string
  thankYouPositiveYes?: string
  thankYouPositiveNo?: string
  /** Used for the just_thank positive branch (no redirect step). */
  thankYouPositiveDirect?: string
  thankYouNegative?: string
}

export function buildCustomStepsFromWizard(
  answers: WizardAnswers,
  opts: BuildCustomStepsOptions = {},
): SurveyStep[] {
  if (answers.metric === 'random') {
    throw new Error(
      "buildCustomStepsFromWizard: metric='random' should short-circuit to " +
        "template='adaptive' before reaching this helper. Caller must " +
        'intercept and use the §2 adaptive survey.create path instead.',
    )
  }

  // Narrowed: metric is one of the 3 concrete WizardMetric values that
  // overlap with SurveyMetric ('csat' | 'nps' | 'ces').
  const metric: JourneyMetric = answers.metric
  const branchOp: 'gte' | 'lte' = INVERTED_METRICS.has(metric) ? 'lte' : 'gte'

  const aspectTags = opts.aspectTags ?? [...DEFAULT_CUSTOM_ASPECT_TAGS]
  const redirectUrl = opts.redirectUrl ?? ''
  const reviewTemplate =
    opts.reviewTemplate ?? 'Had a great experience at {businessName}!'
  const metricQuestion = opts.metricQuestion ?? DEFAULT_METRIC_COPY[metric].question
  const scaleLabels = DEFAULT_METRIC_COPY[metric].scaleLabels
  const feedbackQuestion = opts.feedbackQuestion ?? 'Tell us more (optional).'
  const privacyNote =
    opts.privacyNote ?? 'We will only use this to follow up about your feedback.'
  const thankYouPositiveYes =
    opts.thankYouPositiveYes ?? 'Thank you! Opening the review page now.'
  const thankYouPositiveNo = opts.thankYouPositiveNo ?? 'Thanks for your time!'
  const thankYouPositiveDirect =
    opts.thankYouPositiveDirect ?? 'Thanks for your feedback!'
  const thankYouNegative =
    opts.thankYouNegative ?? "Thank you for the feedback. We'll work on it."

  // Build the negative chain in declared order: aspects → feedback →
  // contact → end. Each step's nextStepId points at the next ID in the
  // chain. Element [0] is what s2_branch.defaultNextStepId points to.
  const { askAspects, askFeedback, collectContact, issueCoupon } = answers.negativeOptions
  const negChain: string[] = []
  if (askAspects) negChain.push(CUSTOM_STEP_IDS.negativeAspects)
  if (askFeedback) negChain.push(CUSTOM_STEP_IDS.negativeFeedback)
  if (collectContact) negChain.push(CUSTOM_STEP_IDS.contact)
  negChain.push(CUSTOM_STEP_IDS.endNegative)

  const positiveTargetId =
    answers.positiveAction === 'just_thank'
      ? CUSTOM_STEP_IDS.positiveThanks
      : CUSTOM_STEP_IDS.positiveRedirect

  const steps: SurveyStep[] = []

  // s1_metric — the rating question.
  steps.push({
    id: CUSTOM_STEP_IDS.metric,
    type: 'ask_metric',
    position: { x: 0, y: 0 },
    config: {
      metric,
      question: metricQuestion,
      scaleLabels,
      onComplete: { nextStepId: CUSTOM_STEP_IDS.branch },
    },
  })

  // s2_branch — single condition + default. Threshold is concrete (not
  // the 'threshold' sentinel adaptive uses) because custom thresholds
  // are owner-set via the wizard.
  steps.push({
    id: CUSTOM_STEP_IDS.branch,
    type: 'branch_by_score',
    position: { x: 0, y: 200 },
    config: {
      metricFromStepId: CUSTOM_STEP_IDS.metric,
      branches: [
        {
          condition: { op: branchOp, value: answers.threshold },
          nextStepId: positiveTargetId,
          label: 'positive',
        },
      ],
      defaultNextStepId: negChain[0]!,
    },
  })

  // Positive branch.
  if (answers.positiveAction === 'just_thank') {
    steps.push({
      id: CUSTOM_STEP_IDS.positiveThanks,
      type: 'end_journey',
      position: { x: -200, y: 400 },
      config: {
        message: thankYouPositiveDirect,
        triggerEvent: 'journey_completed_positive',
      },
    })
  } else {
    const platform: 'google' | 'zomato' =
      answers.positiveAction === 'redirect_zomato' ? 'zomato' : 'google'
    steps.push({
      id: CUSTOM_STEP_IDS.positiveRedirect,
      type: 'redirect',
      position: { x: -240, y: 400 },
      config: {
        platform,
        url: redirectUrl,
        reviewTemplate,
        yesLabel: 'Sure',
        noLabel: 'Maybe later',
        onYesNextStepId: CUSTOM_STEP_IDS.positiveYes,
        onNoNextStepId: CUSTOM_STEP_IDS.positiveNo,
      },
    })
    steps.push({
      id: CUSTOM_STEP_IDS.positiveYes,
      type: 'end_journey',
      position: { x: -360, y: 600 },
      config: {
        message: thankYouPositiveYes,
        triggerEvent: 'journey_completed_positive',
      },
    })
    steps.push({
      id: CUSTOM_STEP_IDS.positiveNo,
      type: 'end_journey',
      position: { x: -120, y: 600 },
      config: {
        message: thankYouPositiveNo,
        triggerEvent: 'journey_completed_positive',
      },
    })
  }

  // Negative chain — each step exists iff its flag is set; pointers
  // already computed in negChain.
  if (askAspects) {
    const idx = negChain.indexOf(CUSTOM_STEP_IDS.negativeAspects)
    steps.push({
      id: CUSTOM_STEP_IDS.negativeAspects,
      type: 'ask_question',
      position: { x: 240, y: 400 },
      config: {
        fieldType: 'multi_select',
        question: 'What went wrong?',
        options: aspectTags,
        required: false,
        onComplete: { nextStepId: negChain[idx + 1]! },
      },
    })
  }

  if (askFeedback) {
    const idx = negChain.indexOf(CUSTOM_STEP_IDS.negativeFeedback)
    steps.push({
      id: CUSTOM_STEP_IDS.negativeFeedback,
      type: 'ask_question',
      position: { x: 240, y: 550 },
      config: {
        fieldType: 'textarea',
        question: feedbackQuestion,
        required: false,
        onComplete: { nextStepId: negChain[idx + 1]! },
      },
    })
  }

  if (collectContact) {
    const idx = negChain.indexOf(CUSTOM_STEP_IDS.contact)
    steps.push({
      id: CUSTOM_STEP_IDS.contact,
      type: 'collect_contact',
      position: { x: 240, y: 700 },
      config: {
        fields: [
          { key: 'name', required: false },
          { key: 'phone', required: false },
          { key: 'email', required: false },
        ],
        privacyNote,
        nextStepId: negChain[idx + 1]!,
      },
    })
  }

  // s_end_negative — always present; coupon attached only when the flag
  // is on AND a templateId was supplied (defensive against the
  // 0-templates state the wizard's checkbox should have prevented).
  const endNegativeConfig: EndJourneyStep['config'] = {
    message: thankYouNegative,
    triggerEvent: 'journey_completed_negative',
  }
  if (issueCoupon && answers.couponTemplateId) {
    endNegativeConfig.issueCoupon = { templateId: answers.couponTemplateId }
  }
  steps.push({
    id: CUSTOM_STEP_IDS.endNegative,
    type: 'end_journey',
    position: { x: 240, y: 850 },
    config: endNegativeConfig,
  })

  return steps
}
