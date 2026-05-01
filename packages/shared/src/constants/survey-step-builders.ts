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

import type { SurveyStep, SurveyMetric } from '../types/survey-steps'

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
