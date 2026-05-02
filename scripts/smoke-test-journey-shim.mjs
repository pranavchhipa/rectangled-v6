/**
 * Hotfix PRD §6 smoke test — journey shim PHASE 1 + PHASE 2 round-trip.
 *
 * Mimics the exact SQL the `submitLegacyJourney` service method runs,
 * inside a single transaction that ROLLBACKs at the end. Verifies the
 * "score-only first call, contact added later" path the diagnostic
 * couldn't exercise.
 *
 * Run with:
 *   set -a && source .env && set +a && node scripts/smoke-test-journey-shim.mjs
 *
 * No data persists. Safe to run against prod.
 */
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

let pass = 0
let fail = 0
function assert(label, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    fail++
  }
}

try {
  console.log('\n[1] Find an active quick-template survey to test against')
  const [survey] = await sql`
    SELECT id, workspace_id, location_id, organization_id, slug, settings
    FROM surveys
    WHERE template = 'quick' AND status = 'active'
    LIMIT 1
  `
  if (!survey) {
    console.error('No active quick survey found. Aborting.')
    process.exit(1)
  }
  console.log(
    `  Survey: ${survey.id.slice(0, 8)}… slug=${survey.slug} workspace=${survey.workspace_id.slice(0, 8)}…`,
  )

  const sessionId = randomUUID()
  const testEmail = `smoke-test-${randomUUID().slice(0, 8)}@example.invalid`
  const testPhone = `+9111111${Math.floor(Math.random() * 100000)}`
  console.log(`  Test session: ${sessionId.slice(0, 8)}…`)
  console.log(`  Test email: ${testEmail}`)

  // Open one transaction for the whole simulated PHASE 1 + PHASE 2 flow.
  await sql.begin(async (tx) => {
    console.log('\n[2] PHASE 1 — submit metric (csat, score=2), no contact')
    // The shim computes isPositive from threshold; for csat=2, threshold=4,
    // expected isPositive = false.
    const isPosPhase1 = 2 >= 4
    const responseDataPhase1 = {
      metricShown: 'csat',
      metricScore: 2,
      csatScore: 2,
    }

    await tx`
      INSERT INTO survey_starts (survey_id, session_id, metadata)
      VALUES (${survey.id}, ${sessionId}, '{}'::jsonb)
      ON CONFLICT (survey_id, session_id) DO NOTHING
    `

    const [responseRow] = await tx`
      INSERT INTO survey_responses (
        survey_id, workspace_id, location_id, customer_id, session_id,
        response_data, metric_shown, metric_score, is_positive,
        score, answers, completed_at, metadata
      ) VALUES (
        ${survey.id}, ${survey.workspace_id}, ${survey.location_id}, NULL,
        ${sessionId}, ${tx.json(responseDataPhase1)}, 'csat', 2, ${isPosPhase1},
        2, '{}'::jsonb, NOW(), '{}'::jsonb
      )
      RETURNING id, customer_id, is_positive, metric_shown, metric_score
    `

    assert(
      'PHASE 1 inserted survey_responses row',
      !!responseRow.id,
      `id=${responseRow?.id?.slice(0, 8)}`,
    )
    assert(
      'PHASE 1 customer_id is null (no contact yet)',
      responseRow.customer_id === null,
    )
    assert(
      'PHASE 1 is_positive is false (csat 2 < threshold 4)',
      responseRow.is_positive === false,
    )

    const [startRow] = await tx`
      SELECT id, completed_at FROM survey_starts
      WHERE survey_id = ${survey.id} AND session_id = ${sessionId}
    `
    assert(
      'PHASE 1 created a survey_starts row',
      !!startRow?.id,
      `start_id=${startRow?.id?.slice(0, 8)}`,
    )
    assert(
      'PHASE 1 survey_starts.completed_at is null',
      startRow.completed_at === null,
    )

    console.log('\n[3] PHASE 2 — follow-up with customerName + customerPhone')
    // Mirrors the shim's PHASE 2 logic when updateResponseId is provided.
    const phase2Contact = {
      name: 'Smoke Test User',
      email: testEmail,
      phone: testPhone,
    }

    // Customer upsert (the shim creates a new customer if existing.customerId is null and any contact field is present).
    const [customerRow] = await tx`
      INSERT INTO customers (workspace_id, name, email, phone)
      VALUES (
        ${survey.workspace_id},
        ${phase2Contact.name},
        ${phase2Contact.email},
        ${phase2Contact.phone}
      )
      RETURNING id, name, email, phone
    `

    assert(
      'PHASE 2 customer row created',
      !!customerRow.id,
      `customer_id=${customerRow?.id?.slice(0, 8)}`,
    )
    assert(
      'PHASE 2 customer name correct',
      customerRow.name === phase2Contact.name,
    )
    assert(
      'PHASE 2 customer email correct',
      customerRow.email === testEmail,
    )

    // Merge response_data (shim does spread merge of existing + new).
    const phase2Patch = {
      acceptedReviewPrompt: false,
      aspectTags: ['Slow service', 'Cold food'],
      feedback: 'Took 30 min for water',
    }
    const merged = { ...responseDataPhase1, ...phase2Patch }
    const isPosPhase2 = 2 >= 4 // recompute from merged state, csat 2 < 4 → false

    const [updatedRow] = await tx`
      UPDATE survey_responses
      SET
        response_data = ${tx.json(merged)},
        customer_id = ${customerRow.id},
        is_positive = ${isPosPhase2},
        completed_at = NOW()
      WHERE id = ${responseRow.id}
      RETURNING id, customer_id, is_positive, response_data
    `

    assert(
      'PHASE 2 updated response.customer_id to the new customer',
      updatedRow.customer_id === customerRow.id,
    )
    assert(
      'PHASE 2 is_positive stays false after merge (csat 2)',
      updatedRow.is_positive === false,
    )
    assert(
      'PHASE 2 response_data has aspectTags from merge',
      Array.isArray(updatedRow.response_data?.aspectTags) &&
        updatedRow.response_data.aspectTags.length === 2,
    )
    assert(
      'PHASE 2 response_data preserves metricShown from PHASE 1',
      updatedRow.response_data?.metricShown === 'csat',
    )

    console.log('\n[4] Lookup the customer by phone (workspace-scoped)')
    const [foundCustomer] = await tx`
      SELECT id, name FROM customers
      WHERE workspace_id = ${survey.workspace_id} AND phone = ${testPhone}
      LIMIT 1
    `
    assert(
      'Customer can be looked up by phone within workspace',
      foundCustomer?.id === customerRow.id,
    )

    // ROLLBACK by throwing — sql.begin() rolls back on thrown errors.
    console.log('\n[5] Rolling back transaction (no test data persists)')
    throw new Error('__ROLLBACK_SMOKE_TEST__')
  }).catch((err) => {
    if (err.message !== '__ROLLBACK_SMOKE_TEST__') throw err
  })

  // Verify rollback worked — no rows should exist with our session_id or test email.
  console.log('\n[6] Verify rollback — no test data persists in prod')
  const [{ count: leftover }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM survey_responses
    WHERE session_id = ${sessionId}
  `
  assert(
    'No survey_responses rows leaked from rollback',
    leftover === 0,
  )

  const [{ count: customerLeftover }] = await sql`
    SELECT COUNT(*)::int AS count FROM customers WHERE email = ${testEmail}
  `
  assert(
    'No customer rows leaked from rollback',
    customerLeftover === 0,
  )

  console.log(`\n=== ${pass} pass · ${fail} fail ===`)
  process.exit(fail === 0 ? 0 : 1)
} catch (err) {
  console.error('\n[SMOKE TEST FAILED]', err)
  process.exit(1)
} finally {
  await sql.end()
}
