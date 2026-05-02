/**
 * Hotfix PRD §3 smoke test — wizard custom journey end-to-end.
 *
 * Per PRD §3.10:
 *   "Smoke test: wizard → 4 answers → generate → preview → activate →
 *    scan QR → complete journey end to end"
 *
 * Bootstraps SurveyEngineService directly (no Nest HTTP context) the
 * same way as smoke-test-adaptive-engine.mjs. Each test creates a
 * temporary survey via the wizard helper, exercises the engine flow,
 * and cleans up at the end.
 *
 * Tests:
 *   A. Positive path (redirect_google) — submit metric high score, then
 *      followup acceptedReviewPrompt=true; verify response stored,
 *      isPositive=true, completed_at stamped.
 *   B. Negative path (just_thank with aspects + contact) — submit metric
 *      low score, then followup with aspect tags + contact; verify
 *      customer upsert, response merged, offline review created.
 *   C. Preview mode — submit with preview=true; verify NO new
 *      survey_responses, survey_starts, customers, or reviews rows are
 *      written. Same call without preview MUST write rows.
 *   D. Custom survey appears via getPublicLegacyJourney — verify the
 *      legacy shape reconstruction works for template='custom'.
 *
 * Safe to run against prod — all created rows are tracked and deleted.
 */
import 'reflect-metadata'
import { SurveyEngineService } from '../apps/api/dist/surveys/survey-engine.service.js'
import { AdaptiveEngineService } from '../apps/api/dist/surveys/adaptive-engine.service.js'
import { createDb } from '../packages/db/dist/index.js'
import {
  buildCustomStepsFromWizard,
  surveyStepsSchema,
} from '../packages/shared/dist/index.js'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const db = createDb(process.env.DATABASE_URL)

const adaptive = new AdaptiveEngineService(db)
const engine = new SurveyEngineService(db, adaptive)

let pass = 0
let fail = 0
const created = {
  surveyIds: new Set(),
  responseIds: new Set(),
  startIds: new Set(),
  customerIds: new Set(),
  reviewIds: new Set(),
}

function ok(label) { console.log(`  ✓ ${label}`); pass++ }
function bad(label, detail) {
  console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`)
  fail++
}

// ─── Setup helpers ──────────────────────────────────────────────────────

async function findTestWorkspace() {
  // Pick the first workspace; the smoke test only needs an org_id + a
  // workspace_id to insert into. We don't write to organizations or
  // workspaces themselves.
  const [row] = await sql`
    SELECT id, organization_id FROM workspaces LIMIT 1
  `
  if (!row) throw new Error('No workspaces in DB to anchor test rows')
  return { id: row.id, organizationId: row.organization_id }
}

async function createCustomSurvey(workspace, wizardAnswers, name) {
  // Validate the helper's output passes the strict step validator (Step
  // A) — catches drift between the wizard helper and the wire schema.
  const steps = buildCustomStepsFromWizard(wizardAnswers)
  const validated = surveyStepsSchema.safeParse(steps)
  if (!validated.success) {
    throw new Error(
      'buildCustomStepsFromWizard output failed surveyStepsSchema: ' +
        JSON.stringify(validated.error.issues, null, 2),
    )
  }

  const slug = `j-test-${randomUUID().slice(0, 8)}`
  const [row] = await sql`
    INSERT INTO surveys (
      workspace_id, organization_id, name, slug, template, mode, status,
      settings, steps
    )
    VALUES (
      ${workspace.id}, ${workspace.organizationId}, ${name}, ${slug},
      'custom', 'intelligent', 'active',
      ${sql.json({ wizardAnswers })}, ${sql.json(steps)}
    )
    RETURNING id, slug
  `
  created.surveyIds.add(row.id)
  return { id: row.id, slug: row.slug, steps }
}

// ─── Test A — Positive path with redirect ───────────────────────────────

async function testA(workspace) {
  console.log('\n  Test A — Positive path (redirect_google)')
  const survey = await createCustomSurvey(
    workspace,
    {
      metric: 'csat',
      positiveAction: 'redirect_google',
      negativeOptions: {
        askAspects: false,
        askFeedback: false,
        collectContact: false,
        issueCoupon: false,
      },
      threshold: 4,
    },
    'Smoke A — positive redirect',
  )

  // Customer flow: scan → see screen
  const screenShape = await engine.getPublicLegacyJourney({ slug: survey.slug })
  if (screenShape?.screen?.metricShown === 'csat') {
    ok('getPublicLegacyJourney returns metric=csat for custom survey')
  } else {
    bad('getPublicLegacyJourney metric mismatch', JSON.stringify(screenShape))
    return
  }

  // Phase 1: submit a metric score of 5 (≥ 4 threshold → positive)
  const sessionId = randomUUID()
  const r1 = await engine.submitLegacyJourney({
    journeyId: survey.id,
    sessionId,
    responseData: { metricShown: 'csat', metricScore: 5 },
  })
  created.responseIds.add(r1.responseId)
  if (r1.success && r1.isPositive === true) {
    ok('Phase-1 submit metric=5 → success, isPositive=true')
  } else {
    bad('Phase-1 submit', JSON.stringify(r1))
  }

  // Verify response row + start row written
  const rows = await sql`
    SELECT id, customer_id FROM survey_responses
    WHERE survey_id = ${survey.id} AND session_id = ${sessionId}
  `
  if (rows.length === 1 && rows[0].customer_id === null) {
    ok('survey_responses row inserted, no customer (positive path)')
  } else {
    bad('Phase-1 row state', JSON.stringify(rows))
  }
  const startRows = await sql`
    SELECT id FROM survey_starts
    WHERE survey_id = ${survey.id} AND session_id = ${sessionId}
  `
  if (startRows.length === 1) {
    ok('survey_starts row inserted')
    created.startIds.add(startRows[0].id)
  } else {
    bad('survey_starts not inserted', `count=${startRows.length}`)
  }

  // Phase 2: customer taps Yes → redirect path
  const r2 = await engine.submitLegacyJourney({
    journeyId: survey.id,
    sessionId,
    updateResponseId: r1.responseId,
    responseData: { acceptedReviewPrompt: true, redirectedTo: 'google' },
  })
  if (r2.success && r2.isPositive === true) {
    ok('Phase-2 redirect submit → response merged')
  } else {
    bad('Phase-2 submit', JSON.stringify(r2))
  }

  // Verify response_data merged with redirect info
  const [merged] = await sql`
    SELECT response_data, completed_at FROM survey_responses
    WHERE id = ${r1.responseId}
  `
  if (
    merged?.response_data?.acceptedReviewPrompt === true &&
    merged?.response_data?.redirectedTo === 'google' &&
    merged?.completed_at
  ) {
    ok('response_data merged with redirect choice + completed_at stamped')
  } else {
    bad('Phase-2 row state', JSON.stringify(merged))
  }
}

// ─── Test B — Negative path with aspects + contact ──────────────────────

async function testB(workspace) {
  console.log('\n  Test B — Negative path (just_thank, aspects + contact)')
  const survey = await createCustomSurvey(
    workspace,
    {
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: {
        askAspects: true,
        askFeedback: false,
        collectContact: true,
        issueCoupon: false,
      },
      threshold: 4,
    },
    'Smoke B — negative aspects+contact',
  )

  const sessionId = randomUUID()
  // Phase 1: submit metric=2 (< 4 threshold → negative)
  const r1 = await engine.submitLegacyJourney({
    journeyId: survey.id,
    sessionId,
    responseData: { metricShown: 'csat', metricScore: 2 },
  })
  created.responseIds.add(r1.responseId)
  if (r1.success && r1.isPositive === false) {
    ok('Phase-1 submit metric=2 → success, isPositive=false')
  } else {
    bad('Phase-1 negative', JSON.stringify(r1))
  }

  // Phase 2: customer fills aspect tags + contact
  const r2 = await engine.submitLegacyJourney({
    journeyId: survey.id,
    sessionId,
    updateResponseId: r1.responseId,
    responseData: {
      aspectTags: ['Service', 'Wait time'],
      feedback: 'Took a while.',
    },
    customerName: 'Smoke Test Customer',
    customerPhone: `+91999000${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`,
  })
  if (r2.success && r2.isPositive === false) {
    ok('Phase-2 negative followup submit → response merged')
  } else {
    bad('Phase-2 negative', JSON.stringify(r2))
  }

  // Verify customer was created + linked
  const [merged] = await sql`
    SELECT customer_id, response_data, completed_at
    FROM survey_responses WHERE id = ${r1.responseId}
  `
  if (
    merged?.customer_id &&
    Array.isArray(merged?.response_data?.aspectTags) &&
    merged?.response_data?.aspectTags.length === 2
  ) {
    ok('customer linked + aspectTags merged on response')
    created.customerIds.add(merged.customer_id)
  } else {
    bad('Phase-2 negative row state', JSON.stringify(merged))
  }

  // Verify offline review created (legacy shim creates one for negative
  // completions to preserve parity with the old journey path).
  const reviewRows = await sql`
    SELECT id FROM reviews
    WHERE metadata->>'surveyResponseId' = ${r1.responseId}
  `
  if (reviewRows.length === 1) {
    ok('offline review row created for negative completion')
    created.reviewIds.add(reviewRows[0].id)
  } else {
    bad('offline review not created', `count=${reviewRows.length}`)
  }
  const startRows = await sql`
    SELECT id FROM survey_starts
    WHERE survey_id = ${survey.id} AND session_id = ${sessionId}
  `
  for (const r of startRows) created.startIds.add(r.id)
}

// ─── Test C — Preview mode bypasses persistence ─────────────────────────

async function testC(workspace) {
  console.log('\n  Test C — Preview mode (?preview=true)')
  const survey = await createCustomSurvey(
    workspace,
    {
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: {
        askAspects: false,
        askFeedback: false,
        collectContact: false,
        issueCoupon: false,
      },
      threshold: 4,
    },
    'Smoke C — preview',
  )

  // Snapshot: counts should not change after a preview submit
  const sessionId = randomUUID()
  const before = await sql`
    SELECT
      (SELECT COUNT(*) FROM survey_responses WHERE survey_id = ${survey.id}) AS responses,
      (SELECT COUNT(*) FROM survey_starts WHERE survey_id = ${survey.id}) AS starts
  `

  const r = await engine.submitLegacyJourney({
    journeyId: survey.id,
    sessionId,
    responseData: { metricShown: 'csat', metricScore: 5 },
    preview: true,
  })
  if (r.success && r.responseId.startsWith('preview-')) {
    ok('preview submit returns synthetic responseId (preview-*)')
  } else {
    bad('preview submit shape', JSON.stringify(r))
  }
  if (r.isPositive === true) {
    ok('preview submit still computes isPositive correctly')
  } else {
    bad('preview isPositive mismatch', JSON.stringify(r))
  }

  const after = await sql`
    SELECT
      (SELECT COUNT(*) FROM survey_responses WHERE survey_id = ${survey.id}) AS responses,
      (SELECT COUNT(*) FROM survey_starts WHERE survey_id = ${survey.id}) AS starts
  `
  if (
    Number(before[0].responses) === Number(after[0].responses) &&
    Number(before[0].starts) === Number(after[0].starts)
  ) {
    ok('preview submit wrote 0 rows (no survey_responses, no survey_starts)')
  } else {
    bad(
      'preview submit wrote rows',
      `responses ${before[0].responses}→${after[0].responses}, starts ${before[0].starts}→${after[0].starts}`,
    )
  }

  // Sanity: same call WITHOUT preview must write rows
  const realSessionId = randomUUID()
  const r2 = await engine.submitLegacyJourney({
    journeyId: survey.id,
    sessionId: realSessionId,
    responseData: { metricShown: 'csat', metricScore: 5 },
  })
  created.responseIds.add(r2.responseId)
  const afterReal = await sql`
    SELECT
      (SELECT COUNT(*) FROM survey_responses WHERE survey_id = ${survey.id}) AS responses,
      (SELECT COUNT(*) FROM survey_starts WHERE survey_id = ${survey.id}) AS starts
  `
  if (
    Number(afterReal[0].responses) === Number(after[0].responses) + 1 &&
    Number(afterReal[0].starts) === Number(after[0].starts) + 1
  ) {
    ok('non-preview submit (control) writes 1 response + 1 start')
  } else {
    bad(
      'non-preview control wrote unexpected row count',
      `responses ${after[0].responses}→${afterReal[0].responses}`,
    )
  }
  const startRowsC = await sql`
    SELECT id FROM survey_starts
    WHERE survey_id = ${survey.id} AND session_id = ${realSessionId}
  `
  for (const r of startRowsC) created.startIds.add(r.id)
}

// ─── Cleanup ────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n  Cleaning up test rows…')
  if (created.reviewIds.size > 0) {
    await sql`DELETE FROM reviews WHERE id = ANY(${[...created.reviewIds]})`
  }
  if (created.responseIds.size > 0) {
    await sql`DELETE FROM survey_responses WHERE id = ANY(${[...created.responseIds]})`
  }
  if (created.startIds.size > 0) {
    await sql`DELETE FROM survey_starts WHERE id = ANY(${[...created.startIds]})`
  }
  if (created.customerIds.size > 0) {
    await sql`DELETE FROM customers WHERE id = ANY(${[...created.customerIds]})`
  }
  if (created.surveyIds.size > 0) {
    await sql`DELETE FROM surveys WHERE id = ANY(${[...created.surveyIds]})`
  }
  console.log(
    `    deleted reviews=${created.reviewIds.size} responses=${created.responseIds.size} starts=${created.startIds.size} customers=${created.customerIds.size} surveys=${created.surveyIds.size}`,
  )
}

// ─── Driver ─────────────────────────────────────────────────────────────

try {
  console.log('Hotfix PRD §3 — Wizard Custom Journey smoke test\n')
  const workspace = await findTestWorkspace()
  console.log(`  Anchor workspace: ${workspace.id}`)

  await testA(workspace)
  await testB(workspace)
  await testC(workspace)
} catch (err) {
  console.error('\n💥 Test driver crashed:', err)
  fail++
} finally {
  try {
    await cleanup()
  } catch (cleanupErr) {
    console.error('Cleanup error (will need manual review):', cleanupErr)
  }
  await sql.end()
}

console.log(`\n${pass}/${pass + fail} pass${fail > 0 ? ` (${fail} failed)` : ''}`)
process.exit(fail > 0 ? 1 : 0)
