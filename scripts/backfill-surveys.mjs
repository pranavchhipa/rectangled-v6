/**
 * Phase 3 Stage B — backfill journeys + truforms into surveys.
 *
 * Idempotent: every insert checks for an existing row by legacy_*_id.
 * Re-running this script is safe — it picks up only new rows since the
 * last run.
 *
 * Run with:
 *   DATABASE_URL=... node scripts/backfill-surveys.mjs
 *
 * After this script, every existing journey has a corresponding survey
 * with template='quick', and every truform has one with template='deep'.
 * Their responses are mirrored into survey_responses with the legacy IDs
 * preserved so we can cross-reference.
 */

import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import 'dotenv/config'

// We could import buildQuickIntelligentSteps / buildDeepIntelligentSteps from
// @rectangled/shared, but this script runs as plain Node from the repo root.
// Inlining the relevant subset here keeps the script self-contained.

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

const DEFAULT_ASPECT_TAGS = [
  'Food quality',
  'Service',
  'Cleanliness',
  'Wait time',
  'Value',
  'Staff',
]

function buildQuickIntelligentSteps(opts) {
  const enabledMetricsForRandom =
    opts?.enabledMetrics ?? ['csat', 'nps', 'ces', 'nev', 'cli']
  const reviewPlatform = opts?.reviewPlatform ?? 'google'
  const redirectUrl = opts?.redirectUrl ?? ''
  const reviewTemplate =
    opts?.reviewTemplate ?? 'Had a great experience at {businessName}!'
  const aspectTags = opts?.aspectTags ?? DEFAULT_ASPECT_TAGS
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

function buildDeepIntelligentSteps(type, opts) {
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

let stats = {
  journeysProcessed: 0,
  journeysCreated: 0,
  truformsProcessed: 0,
  truformsCreated: 0,
  journeyResponsesProcessed: 0,
  journeyResponsesCreated: 0,
  truformResponsesProcessed: 0,
  truformResponsesCreated: 0,
}

try {
  // ─── 1. Migrate journeys → surveys ─────────────────────────────────
  console.log('\n[1/4] Migrating journeys → surveys (template=quick)')
  const journeys = await sql`
    SELECT j.*, w.organization_id
    FROM journeys j
    JOIN workspaces w ON w.id = j.workspace_id
  `
  stats.journeysProcessed = journeys.length

  for (const j of journeys) {
    const existing = await sql`
      SELECT id FROM surveys WHERE legacy_journey_id = ${j.id} LIMIT 1
    `
    if (existing.length > 0) continue

    // Try to read existing screen config to carry over user customisations.
    const screens = await sql`
      SELECT * FROM journey_screens
      WHERE journey_id = ${j.id} AND screen_type = 'metric_question'
      ORDER BY "order" ASC LIMIT 1
    `
    const screen = screens[0]
    const screenConfig = screen?.config ?? {}
    const settings = j.settings ?? {}

    const steps = buildQuickIntelligentSteps({
      enabledMetrics: settings.enabledMetrics,
      reviewPlatform: settings.reviewPlatform ?? 'google',
      redirectUrl: screenConfig.redirectLinks?.google ?? '',
      reviewTemplate:
        screenConfig.reviewTemplate ?? 'Had a great experience at {businessName}!',
      aspectTags: screenConfig.aspectTags ?? DEFAULT_ASPECT_TAGS,
      thankYouHappyYes: screenConfig.thankYouHappyYes,
      thankYouHappyNo: screenConfig.thankYouHappyNo,
      thankYouUnhappy: screenConfig.thankYouUnhappy,
    })

    const status = j.archived_at
      ? 'archived'
      : j.is_active
        ? 'active'
        : 'draft'

    await sql`
      INSERT INTO surveys (
        id, workspace_id, location_id, organization_id,
        name, slug, template, mode, status,
        settings, steps,
        legacy_journey_id, archived_at, created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${j.workspace_id},
        ${j.location_id},
        ${j.organization_id},
        ${j.name},
        ${j.slug},
        'quick',
        'intelligent',
        ${status},
        ${sql.json(settings)},
        ${sql.json(steps)},
        ${j.id},
        ${j.archived_at},
        ${j.created_at},
        ${j.updated_at}
      )
    `
    stats.journeysCreated++
    process.stdout.write('.')
  }
  console.log(`\n  → ${stats.journeysCreated} new survey(s) created`)

  // ─── 2. Migrate truforms → surveys ─────────────────────────────────
  console.log('\n[2/4] Migrating truforms → surveys (template=deep)')
  const truforms = await sql`
    SELECT t.*, w.organization_id
    FROM truforms t
    JOIN workspaces w ON w.id = t.workspace_id
  `
  stats.truformsProcessed = truforms.length

  for (const t of truforms) {
    const existing = await sql`
      SELECT id FROM surveys WHERE legacy_truform_id = ${t.id} LIMIT 1
    `
    if (existing.length > 0) continue

    const config = t.config ?? {}
    const steps = buildDeepIntelligentSteps(t.type, {
      thankYouMessage: config.thankYouMessage,
    })

    const settings = {
      type: t.type,
      branding: config.branding ?? {},
      thankYouMessage: config.thankYouMessage ?? 'Thanks for your feedback!',
    }

    await sql`
      INSERT INTO surveys (
        id, workspace_id, location_id, organization_id,
        name, slug, template, mode, status,
        settings, steps,
        legacy_truform_id, created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${t.workspace_id},
        ${t.location_id},
        ${t.organization_id},
        ${t.name},
        ${t.slug},
        'deep',
        'intelligent',
        ${t.status},
        ${sql.json(settings)},
        ${sql.json(steps)},
        ${t.id},
        ${t.created_at},
        ${t.updated_at}
      )
    `
    stats.truformsCreated++
    process.stdout.write('.')
  }
  console.log(`\n  → ${stats.truformsCreated} new survey(s) created`)

  // ─── 3. Migrate journey_responses → survey_responses ───────────────
  console.log('\n[3/4] Migrating journey_responses → survey_responses')
  const journeyResponses = await sql`
    SELECT jr.*, j.workspace_id, j.location_id
    FROM journey_responses jr
    JOIN journeys j ON j.id = jr.journey_id
  `
  stats.journeyResponsesProcessed = journeyResponses.length

  for (const jr of journeyResponses) {
    const existing = await sql`
      SELECT id FROM survey_responses
      WHERE legacy_journey_response_id = ${jr.id} LIMIT 1
    `
    if (existing.length > 0) continue

    const survey = await sql`
      SELECT id FROM surveys WHERE legacy_journey_id = ${jr.journey_id} LIMIT 1
    `
    if (survey.length === 0) continue // shouldn't happen, but skip orphans

    const data = jr.response_data ?? {}
    const metricShown = data.metricShown ?? null
    const metricScore =
      typeof data.metricScore === 'number' ? data.metricScore : null

    await sql`
      INSERT INTO survey_responses (
        id, survey_id, workspace_id, location_id, customer_id,
        session_id, response_data,
        metric_shown, metric_score, score, answers,
        completed_at, started_at, metadata,
        legacy_journey_response_id, created_at
      ) VALUES (
        ${randomUUID()},
        ${survey[0].id},
        ${jr.workspace_id},
        ${jr.location_id},
        ${jr.customer_id},
        ${jr.session_id},
        ${sql.json(data)},
        ${metricShown},
        ${metricScore},
        ${metricScore},
        ${sql.json({})},
        ${jr.created_at},
        ${jr.created_at},
        ${sql.json({})},
        ${jr.id},
        ${jr.created_at}
      )
    `
    stats.journeyResponsesCreated++
  }
  console.log(`  → ${stats.journeyResponsesCreated} new response(s) created`)

  // ─── 4. Migrate truform_responses → survey_responses ───────────────
  console.log('\n[4/4] Migrating truform_responses → survey_responses')
  const truformResponses = await sql`
    SELECT tr.*, t.workspace_id, t.location_id
    FROM truform_responses tr
    JOIN truforms t ON t.id = tr.truform_id
  `
  stats.truformResponsesProcessed = truformResponses.length

  for (const tr of truformResponses) {
    const existing = await sql`
      SELECT id FROM survey_responses
      WHERE legacy_truform_response_id = ${tr.id} LIMIT 1
    `
    if (existing.length > 0) continue

    const survey = await sql`
      SELECT id FROM surveys WHERE legacy_truform_id = ${tr.truform_id} LIMIT 1
    `
    if (survey.length === 0) continue

    await sql`
      INSERT INTO survey_responses (
        id, survey_id, workspace_id, location_id, customer_id,
        session_id, response_data,
        score, answers,
        completed_at, started_at, metadata,
        legacy_truform_response_id, created_at
      ) VALUES (
        ${randomUUID()},
        ${survey[0].id},
        ${tr.workspace_id},
        ${tr.location_id},
        ${tr.customer_id},
        ${tr.session_id || randomUUID()},
        ${sql.json(tr.answers ?? {})},
        ${tr.score},
        ${sql.json(tr.answers ?? {})},
        ${tr.completed_at},
        ${tr.created_at},
        ${sql.json(tr.metadata ?? {})},
        ${tr.id},
        ${tr.created_at}
      )
    `
    stats.truformResponsesCreated++
  }
  console.log(`  → ${stats.truformResponsesCreated} new response(s) created`)

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('\n=== Backfill summary ===')
  console.log(`  journeys:           ${stats.journeysProcessed} processed, ${stats.journeysCreated} new surveys`)
  console.log(`  truforms:           ${stats.truformsProcessed} processed, ${stats.truformsCreated} new surveys`)
  console.log(`  journey_responses:  ${stats.journeyResponsesProcessed} processed, ${stats.journeyResponsesCreated} new survey_responses`)
  console.log(`  truform_responses:  ${stats.truformResponsesProcessed} processed, ${stats.truformResponsesCreated} new survey_responses`)

  // Cross-check counts.
  const [
    [{ count: surveysQuick }],
    [{ count: surveysDeep }],
    [{ count: srTotal }],
    [{ count: jrTotal }],
    [{ count: trTotal }],
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM surveys WHERE template='quick'`,
    sql`SELECT COUNT(*)::int AS count FROM surveys WHERE template='deep'`,
    sql`SELECT COUNT(*)::int AS count FROM survey_responses`,
    sql`SELECT COUNT(*)::int AS count FROM journey_responses`,
    sql`SELECT COUNT(*)::int AS count FROM truform_responses`,
  ])
  console.log('\n=== Verification ===')
  console.log(`  surveys.template=quick : ${surveysQuick}  (vs journeys.count: ${stats.journeysProcessed})`)
  console.log(`  surveys.template=deep  : ${surveysDeep}   (vs truforms.count: ${stats.truformsProcessed})`)
  console.log(`  survey_responses total : ${srTotal}  (vs journey_responses + truform_responses: ${jrTotal + trTotal})`)
} catch (err) {
  console.error('\n[BACKFILL FAILED]', err)
  process.exit(1)
} finally {
  await sql.end()
}
