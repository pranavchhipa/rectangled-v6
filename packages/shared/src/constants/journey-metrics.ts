/**
 * Adaptive Customer Journey v2 — metric definitions and threshold helpers.
 *
 * The customer sees ONE randomly-picked metric per visit (CSAT, NPS, CES, NEV, or CLI).
 * Routing into the happy/unhappy branches uses a per-metric threshold because each
 * metric has a different scale and CES is INVERTED (lower scores = better).
 *
 * Lives in @rectangled/shared so both the API (server-side decision) and the web
 * public page (UI rendering) read from the same source of truth. The web page
 * never receives the threshold — only the API uses it.
 */

export type JourneyMetric = 'csat' | 'nps' | 'ces' | 'nev' | 'cli'

export const JOURNEY_METRICS: readonly JourneyMetric[] = [
  'csat',
  'nps',
  'ces',
  'nev',
  'cli',
] as const

export const METRIC_RANGES: Record<JourneyMetric, { min: number; max: number }> = {
  csat: { min: 1, max: 5 },
  nps: { min: 0, max: 10 },
  ces: { min: 1, max: 7 },
  nev: { min: -100, max: 100 },
  cli: { min: 1, max: 7 },
}

export const METRIC_DEFAULT_THRESHOLDS: Record<JourneyMetric, number> = {
  csat: 4,
  nps: 9,
  ces: 3,
  nev: 0,
  cli: 5,
}

/**
 * CES is inverted: lower scores = better experience.
 * All other metrics: higher = better.
 */
export const INVERTED_METRICS: ReadonlySet<JourneyMetric> = new Set<JourneyMetric>(['ces'])

export function isJourneyMetric(value: unknown): value is JourneyMetric {
  return typeof value === 'string' && (JOURNEY_METRICS as readonly string[]).includes(value)
}

export function isScoreInRange(metric: JourneyMetric, score: number): boolean {
  const range = METRIC_RANGES[metric]
  return Number.isFinite(score) && score >= range.min && score <= range.max
}

export function isPositive(
  metric: JourneyMetric,
  score: number,
  threshold: number,
): boolean {
  if (INVERTED_METRICS.has(metric)) {
    return score <= threshold
  }
  return score >= threshold
}

export function getDefaultThreshold(metric: JourneyMetric): number {
  return METRIC_DEFAULT_THRESHOLDS[metric]
}

export function pickRandomMetric(enabled: readonly JourneyMetric[]): JourneyMetric {
  if (enabled.length === 0) {
    throw new Error('No metrics enabled for this journey')
  }
  return enabled[Math.floor(Math.random() * enabled.length)]!
}

/**
 * Default copy seeded into a fresh `metric_question` screen on journey creation.
 */
export const DEFAULT_METRIC_COPY: Record<
  JourneyMetric,
  { question: string; scaleLabels: { low: string; high: string } }
> = {
  csat: {
    question: 'How satisfied are you with your experience?',
    scaleLabels: { low: 'Very unsatisfied', high: 'Very satisfied' },
  },
  nps: {
    question: 'How likely are you to recommend us to a friend?',
    scaleLabels: { low: 'Not at all likely', high: 'Extremely likely' },
  },
  ces: {
    question: 'How easy was it to get what you needed today?',
    scaleLabels: { low: 'Very easy', high: 'Very difficult' },
  },
  nev: {
    question: 'How did your experience make you feel?',
    scaleLabels: { low: 'Very negative', high: 'Very positive' },
  },
  cli: {
    question: 'How likely are you to keep choosing us in the future?',
    scaleLabels: { low: 'Not likely at all', high: 'Extremely likely' },
  },
}

export const DEFAULT_METRIC_QUESTION_CONFIG = {
  metricCopy: DEFAULT_METRIC_COPY,
  aspectTags: [
    'Food quality',
    'Service',
    'Cleanliness',
    'Wait time',
    'Value',
    'Staff',
  ] as string[],
  feedbackPlaceholder: 'Tell us what went wrong, in your own words.',
  reviewPromptCopy: {
    question: 'Would you mind leaving us a review?',
    yesLabel: 'Sure',
    noLabel: 'Maybe later',
  },
  redirectLinks: {} as { google?: string; zomato?: string; swiggy?: string },
  reviewTemplate: 'Had a great experience at {businessName}!',
  thankYouHappyYes: 'Thank you! Opening the review page now.',
  thankYouHappyNo: 'Thanks for your time!',
  thankYouUnhappy: "Thank you for the feedback. We'll work on it.",
}

export const DEFAULT_JOURNEY_SETTINGS_V2 = {
  enableCoupon: false,
  reviewPlatform: 'google' as 'google' | 'zomato' | 'swiggy',
  enabledMetrics: [...JOURNEY_METRICS] as JourneyMetric[],
  thresholds: { ...METRIC_DEFAULT_THRESHOLDS },
}
