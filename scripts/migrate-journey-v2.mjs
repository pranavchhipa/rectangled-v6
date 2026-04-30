/**
 * Migration: Adaptive Customer Journey v2
 *
 * Converts every existing journey from the v1 single-screen rating model
 * to the v2 metric_question model. Idempotent — running twice is safe.
 *
 * For each journey:
 *   1. Skip if settings already has `enabledMetrics` (already migrated).
 *   2. Extend settings with v2 fields, preserving v1 positiveThreshold for safety.
 *   3. Build a new metric_question config from defaults, carrying over the
 *      v1 rating screen's redirectLinks / feedbackTags / thankYouMessage when
 *      they exist.
 *   4. In a single transaction: update settings, delete old screens, insert
 *      one metric_question screen.
 *
 * Run with:
 *   DATABASE_URL=postgres://... node scripts/migrate-journey-v2.mjs
 *
 * Or set DATABASE_URL in .env and use a wrapper. The script reads DATABASE_URL
 * directly — no app bootstrap.
 */

import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Aborting.')
  process.exit(1)
}

const DEFAULT_METRIC_COPY = {
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

const DEFAULT_REVIEW_PROMPT = {
  question: 'Would you mind leaving us a review?',
  yesLabel: 'Sure',
  noLabel: 'Maybe later',
}

const DEFAULT_ASPECT_TAGS = [
  'Food quality',
  'Service',
  'Cleanliness',
  'Wait time',
  'Value',
  'Staff',
]

const sql = postgres(DATABASE_URL, { max: 1 })

let total = 0
let migrated = 0
let skipped = 0
let failed = 0

try {
  const rows = await sql`SELECT id, settings FROM journeys`
  total = rows.length
  console.log(`Found ${total} journeys.`)

  for (const j of rows) {
    const settings = j.settings ?? {}

    // Idempotency check by SCREEN, not just settings — a journey can have
    // v2 settings but no metric_question screen (e.g. if the original screen
    // insert failed because the enum value didn't exist yet).
    const hasMetricScreen = await sql`
      SELECT 1 FROM journey_screens
      WHERE journey_id = ${j.id} AND screen_type = 'metric_question'
      LIMIT 1
    `
    if (hasMetricScreen.length > 0 && settings.enabledMetrics) {
      skipped++
      continue
    }

    const oldThreshold = settings.positiveThreshold ?? 4

    const newSettings = {
      ...settings,
      enabledMetrics: ['csat', 'nps', 'ces', 'nev', 'cli'],
      thresholds: {
        csat: oldThreshold, // map v1 1-5 threshold onto CSAT (same scale)
        nps: 9,
        ces: 3,
        nev: 0,
        cli: 5,
      },
      reviewPlatform: settings.reviewPlatform ?? 'google',
      enableCoupon: settings.enableCoupon ?? false,
      // Keep positiveThreshold for one release for safety; remove in cleanup PR.
      positiveThreshold: oldThreshold,
    }

    // Find the v1 rating screen (lowest order) to carry config forward.
    const oldScreens = await sql`
      SELECT id, screen_type, "order", config
      FROM journey_screens
      WHERE journey_id = ${j.id}
      ORDER BY "order" ASC
    `

    const ratingScreen =
      oldScreens.find((s) => s.screen_type === 'rating') ?? oldScreens[0]
    const oldConfig = (ratingScreen?.config ?? {})

    // Carry over redirectLinks if they exist in either v1 shape (array on rating
    // screen, or array on review_redirect screen).
    let redirectLinks = {}
    if (Array.isArray(oldConfig.redirectLinks)) {
      const google = oldConfig.redirectLinks.find((l) => l?.platform === 'Google')
      if (google?.url) redirectLinks.google = google.url
    }
    const reviewRedirectScreen = oldScreens.find((s) => s.screen_type === 'review_redirect')
    if (reviewRedirectScreen) {
      const links = reviewRedirectScreen.config?.links
      if (Array.isArray(links)) {
        const google = links.find((l) => l?.platform === 'Google')
        if (google?.url && !redirectLinks.google) redirectLinks.google = google.url
      }
    }

    const aspectTags = Array.isArray(oldConfig.feedbackTags)
      ? oldConfig.feedbackTags
      : DEFAULT_ASPECT_TAGS

    const feedbackPlaceholder =
      typeof oldConfig.feedbackPlaceholder === 'string'
        ? oldConfig.feedbackPlaceholder
        : 'Tell us what went wrong, in your own words.'

    const oldThankYou =
      typeof oldConfig.thankYouMessage === 'string' ? oldConfig.thankYouMessage : null

    const newConfig = {
      metricCopy: DEFAULT_METRIC_COPY,
      aspectTags,
      feedbackPlaceholder,
      reviewPromptCopy: DEFAULT_REVIEW_PROMPT,
      redirectLinks,
      reviewTemplate: 'Had a great experience at {businessName}!',
      thankYouHappyYes: oldThankYou ?? 'Thank you! Opening the review page now.',
      thankYouHappyNo: 'Thanks for your time!',
      thankYouUnhappy: oldThankYou ?? 'Thank you for the feedback.',
    }

    try {
      await sql.begin(async (tx) => {
        await tx`
          UPDATE journeys
          SET settings = ${tx.json(newSettings)}, updated_at = NOW()
          WHERE id = ${j.id}
        `
        await tx`DELETE FROM journey_screens WHERE journey_id = ${j.id}`
        await tx`
          INSERT INTO journey_screens (journey_id, "order", screen_type, title, config, branch_conditions)
          VALUES (
            ${j.id},
            0,
            'metric_question',
            'How was your experience?',
            ${tx.json(newConfig)},
            ${tx.json([])}
          )
        `
      })
      migrated++
      console.log(`  ✓ migrated ${j.id}`)
    } catch (err) {
      failed++
      console.error(`  ✗ FAILED ${j.id}:`, err.message)
    }
  }
} finally {
  await sql.end()
}

console.log('\n=== Summary ===')
console.log(`  total:     ${total}`)
console.log(`  migrated:  ${migrated}`)
console.log(`  skipped:   ${skipped} (already v2)`)
console.log(`  failed:    ${failed}`)
process.exit(failed > 0 ? 1 : 0)
