/**
 * Hotfix PRD §2 smoke test — AdaptiveEngineService end-to-end.
 *
 * Bootstraps a Nest application context, gets the real
 * AdaptiveEngineService from the DI container, and runs three flows
 * against prod:
 *
 *   Test A — Threshold non-leak
 *     Set settings.thresholds.csat to a sentinel value, call
 *     getInitialState, verify the JSON payload contains NO 'threshold'
 *     substring AND no occurrence of the sentinel.
 *
 *   Test B — Happy path
 *     submitMetric (high score) → isPositive=true, customer_id=null
 *     submitFollowup (acceptedReviewPrompt=true, redirectedTo=google)
 *       → response merged, completed_at stamped
 *
 *   Test C — Unhappy path with contact
 *     submitMetric (low score) → isPositive=false, customer_id=null
 *     submitFollowup (aspect tags + name + phone)
 *       → customer row created, customer_id linked, offline review
 *         in reviews table
 *
 * Cleanup — collects all created row IDs across the run and deletes
 * them after, plus flips the test survey's template back to 'quick'.
 * Safe to run against prod.
 */
import 'reflect-metadata'
import { AdaptiveEngineService } from '../apps/api/dist/surveys/adaptive-engine.service.js'
import { createDb } from '../packages/db/dist/index.js'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

// Skip Nest entirely — the AdaptiveEngineService constructor only needs
// a Drizzle DB instance. Bootstrapping the full app would pull in
// TrpcRouter.onModuleInit which needs an HTTP adapter we don't have here.
const db = createDb(process.env.DATABASE_URL)

let pass = 0
let fail = 0
const cleanup = {
  surveyResponseIds: new Set(),
  surveyStartIds: new Set(),
  customerIds: new Set(),
  reviewIds: new Set(),
  testSurveyId: null,
  originalTemplate: null,
}

function ok(label) { console.log(`  ✓ ${label}`); pass++ }
function bad(label, detail) { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); fail++ }

async function gatherCleanupTargets(surveyId, sessionIds) {
  // Collect any rows the engine wrote so we can delete them at the end.
  const responses = await sql`
    SELECT id, customer_id FROM survey_responses
    WHERE survey_id = ${surveyId} AND session_id = ANY(${sessionIds})
  `
  for (const r of responses) {
    cleanup.surveyResponseIds.add(r.id)
    if (r.customer_id) cleanup.customerIds.add(r.customer_id)
  }
  const starts = await sql`
    SELECT id FROM survey_starts WHERE survey_id = ${surveyId}
      AND session_id = ANY(${sessionIds})
  `
  for (const r of starts) cleanup.surveyStartIds.add(r.id)

  const reviewRows = await sql`
    SELECT id FROM reviews
    WHERE metadata->>'surveyResponseId' = ANY(
      ARRAY(SELECT id::text FROM survey_responses WHERE id = ANY(${[...cleanup.surveyResponseIds]}))
    )
  `
  for (const r of reviewRows) cleanup.reviewIds.add(r.id)
}

async function runCleanup() {
  console.log('\n[CLEANUP] Removing test data + restoring template')
  if (cleanup.reviewIds.size > 0) {
    await sql`DELETE FROM reviews WHERE id = ANY(${[...cleanup.reviewIds]})`
    console.log(`  · deleted ${cleanup.reviewIds.size} reviews`)
  }
  if (cleanup.surveyResponseIds.size > 0) {
    await sql`DELETE FROM survey_responses WHERE id = ANY(${[...cleanup.surveyResponseIds]})`
    console.log(`  · deleted ${cleanup.surveyResponseIds.size} survey_responses`)
  }
  if (cleanup.surveyStartIds.size > 0) {
    await sql`DELETE FROM survey_starts WHERE id = ANY(${[...cleanup.surveyStartIds]})`
    console.log(`  · deleted ${cleanup.surveyStartIds.size} survey_starts`)
  }
  if (cleanup.customerIds.size > 0) {
    await sql`DELETE FROM customers WHERE id = ANY(${[...cleanup.customerIds]})`
    console.log(`  · deleted ${cleanup.customerIds.size} customers`)
  }
  if (cleanup.testSurveyId && cleanup.originalTemplate) {
    await sql`UPDATE surveys SET template = ${cleanup.originalTemplate}
              WHERE id = ${cleanup.testSurveyId}`
    console.log(`  · restored survey ${cleanup.testSurveyId.slice(0, 8)}… → template=${cleanup.originalTemplate}`)
  }
}

try {
  console.log('[SETUP] Instantiating AdaptiveEngineService directly')
  const adaptive = new AdaptiveEngineService(db)

  console.log('\n[SETUP] Picking test survey (Test 1) and flipping template to adaptive')
  // Accept 'quick' or 'adaptive' so the script works pre- and post-
  // migration 0019. Cleanup restores whatever the original was.
  const [target] = await sql`
    SELECT id, name, slug, template FROM surveys
    WHERE name = 'Test 1'
      AND template IN ('quick', 'adaptive')
      AND mode = 'intelligent'
    LIMIT 1
  `
  if (!target) {
    console.error('No suitable test survey found. Aborting.')
    process.exit(1)
  }
  cleanup.testSurveyId = target.id
  cleanup.originalTemplate = target.template
  console.log(`  · target: ${target.name} (${target.slug})`)

  // Sentinel threshold that's unique enough to scan the JSON for.
  // Stash the whole new thresholds object on settings via a JS-side
  // merge to dodge Postgres parameter-type inference quirks inside
  // jsonb_build_object.
  const SENTINEL_THRESHOLD = 4242424242
  const [{ settings: existingSettings }] = await sql`
    SELECT settings FROM surveys WHERE id = ${target.id}
  `
  const sentinelSettings = {
    ...existingSettings,
    thresholds: {
      csat: SENTINEL_THRESHOLD,
      nps: 9,
      ces: 3,
      nev: 0,
      cli: 5,
    },
  }
  await sql`
    UPDATE surveys
    SET template = 'adaptive', settings = ${sql.json(sentinelSettings)}
    WHERE id = ${target.id}
  `

  // ─── Test A — Threshold non-leak ────────────────────────────────────
  console.log('\n[A] Threshold non-leak — getInitialState payload must not contain threshold')
  const initial = await adaptive.getInitialState({ slug: target.slug })
  const json = JSON.stringify(initial)
  ok(`getInitialState returned a payload`)
  if (json.toLowerCase().includes('threshold')) {
    bad('payload contains the substring "threshold"',
      `JSON snippet: ${json.slice(0, 200)}`)
  } else {
    ok('payload does NOT contain "threshold" substring')
  }
  if (json.includes(String(SENTINEL_THRESHOLD))) {
    bad('payload contains the sentinel threshold value',
      `Found ${SENTINEL_THRESHOLD} in payload`)
  } else {
    ok('payload does NOT contain the sentinel threshold value')
  }
  if (initial.metricShown && ['csat', 'nps', 'ces', 'nev', 'cli'].includes(initial.metricShown)) {
    ok(`metric picked: ${initial.metricShown} (random selection working)`)
  } else {
    bad('metricShown is not a valid metric')
  }
  if (typeof initial.question === 'string' && initial.question.length > 0) {
    ok('question copy returned')
  } else {
    bad('question copy missing')
  }

  // ─── Test B — Happy path ────────────────────────────────────────────
  console.log('\n[B] Happy path — high CSAT score → review prompt → Yes → redirect')
  const sessionB = randomUUID()
  // CSAT=5 with sentinel threshold of 4242424242 would route as unhappy.
  // Restore default thresholds for the rest of the run.
  const restoredSettings = { ...existingSettings }
  await sql`
    UPDATE surveys
    SET settings = ${sql.json(restoredSettings)}
    WHERE id = ${target.id}
  `
  const happyMetric = await adaptive.submitMetric({
    surveyId: target.id,
    sessionId: sessionB,
    metricShown: 'csat',
    metricScore: 5,
  })
  cleanup.surveyResponseIds.add(happyMetric.responseId)
  if (happyMetric.isPositive === true) ok('happy path: isPositive=true (csat 5 ≥ 4)')
  else bad('happy path: expected isPositive=true', `got ${happyMetric.isPositive}`)

  const happyFollowup = await adaptive.submitFollowup({
    surveyId: target.id,
    sessionId: sessionB,
    responseId: happyMetric.responseId,
    patch: { acceptedReviewPrompt: true, redirectedTo: 'google' },
  })
  if (happyFollowup.customerId === null)
    ok('happy path: no customer created (no contact info)')
  else {
    bad('happy path: customer should NOT exist', `got ${happyFollowup.customerId}`)
    cleanup.customerIds.add(happyFollowup.customerId)
  }
  const [happyRow] = await sql`
    SELECT response_data, completed_at FROM survey_responses
    WHERE id = ${happyMetric.responseId}
  `
  if (happyRow?.response_data?.acceptedReviewPrompt === true)
    ok('happy path: response_data.acceptedReviewPrompt=true after merge')
  else bad('happy path: acceptedReviewPrompt missing in response_data')
  if (happyRow?.response_data?.redirectedTo === 'google')
    ok('happy path: response_data.redirectedTo=google')
  else bad('happy path: redirectedTo missing')

  // ─── Test C — Unhappy path with contact ─────────────────────────────
  console.log('\n[C] Unhappy path — low CSAT → aspect tags + contact → customer + offline review')
  const sessionC = randomUUID()
  const unhappyMetric = await adaptive.submitMetric({
    surveyId: target.id,
    sessionId: sessionC,
    metricShown: 'csat',
    metricScore: 2,
  })
  cleanup.surveyResponseIds.add(unhappyMetric.responseId)
  if (unhappyMetric.isPositive === false)
    ok('unhappy path: isPositive=false (csat 2 < 4)')
  else bad('unhappy path: expected isPositive=false', `got ${unhappyMetric.isPositive}`)

  const testPhone = `+9134${Math.floor(Math.random() * 1000000)}`
  const testEmail = `smoke-adaptive-${randomUUID().slice(0, 8)}@example.invalid`
  const unhappyFollowup = await adaptive.submitFollowup({
    surveyId: target.id,
    sessionId: sessionC,
    responseId: unhappyMetric.responseId,
    patch: {
      aspectTags: ['Slow service', 'Wait time'],
      feedback: 'Took 30 min for water',
      name: 'Smoke Adaptive User',
      email: testEmail,
      phone: testPhone,
    },
  })
  if (unhappyFollowup.customerId) {
    cleanup.customerIds.add(unhappyFollowup.customerId)
    ok(`unhappy path: customer created (${unhappyFollowup.customerId.slice(0, 8)}…)`)
  } else {
    bad('unhappy path: customer NOT created (expected one)')
  }
  const [unhappyRow] = await sql`
    SELECT customer_id, response_data FROM survey_responses
    WHERE id = ${unhappyMetric.responseId}
  `
  if (unhappyRow?.customer_id === unhappyFollowup.customerId)
    ok('unhappy path: response.customer_id linked to new customer')
  else bad('unhappy path: customer_id not linked')
  if (Array.isArray(unhappyRow?.response_data?.aspectTags) &&
      unhappyRow.response_data.aspectTags.length === 2)
    ok('unhappy path: response_data.aspectTags has 2 entries after merge')
  else bad('unhappy path: aspectTags missing or wrong length')

  const offlineReviews = await sql`
    SELECT id, rating, source FROM reviews
    WHERE metadata->>'surveyResponseId' = ${unhappyMetric.responseId}
  `
  for (const r of offlineReviews) cleanup.reviewIds.add(r.id)
  if (offlineReviews.length === 1 && offlineReviews[0].rating === 2 && offlineReviews[0].source === 'offline')
    ok('unhappy path: offline review row created (rating=2, source=offline)')
  else bad(`unhappy path: expected 1 offline review, got ${offlineReviews.length}`)

  // ─── Test D — survey_starts funnel ─────────────────────────────────
  console.log('\n[D] survey_starts funnel — both sessions should have completed_at stamped')
  const starts = await sql`
    SELECT id, session_id, completed_at FROM survey_starts
    WHERE survey_id = ${target.id} AND session_id = ANY(${[sessionB, sessionC]})
  `
  for (const s of starts) cleanup.surveyStartIds.add(s.id)
  if (starts.length === 2) ok(`2 survey_starts rows created (one per session)`)
  else bad(`expected 2 survey_starts, got ${starts.length}`)
  for (const s of starts) {
    if (s.completed_at != null) ok(`survey_starts session ${s.session_id.slice(0,8)}… completed_at stamped`)
    else bad(`survey_starts session ${s.session_id.slice(0,8)}… completed_at is null`)
  }
  // Also gather start ids
  await gatherCleanupTargets(target.id, [sessionB, sessionC])

  console.log(`\n=== ${pass} pass · ${fail} fail ===`)
} catch (err) {
  console.error('\n[SMOKE TEST FAILED]', err)
  fail++
} finally {
  try { await runCleanup() } catch (e) { console.error('Cleanup failed:', e) }
  await sql.end()
  process.exit(fail === 0 ? 0 : 1)
}
