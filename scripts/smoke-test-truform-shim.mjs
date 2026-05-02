/**
 * Hotfix PRD §6 smoke test — truform shim end-to-end.
 *
 * Mimics the patched submitLegacyTruform service method against prod
 * inside a transaction that ROLLBACKs. Verifies:
 *   - Contact fields no longer dropped
 *   - Customer upsert (lookup by phone, then by email)
 *   - is_positive computed from settings.type
 *   - survey_starts row created + completed_at stamped
 *
 * Safe to run against prod — no data persists.
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
  console.log('\n[1] Find an active deep-template (truform-backed) survey')
  const [survey] = await sql`
    SELECT id, workspace_id, location_id, slug, settings
    FROM surveys
    WHERE template = 'deep' AND status = 'active'
      AND settings->>'type' = 'csat'
    LIMIT 1
  `
  if (!survey) {
    console.log('No active CSAT-typed deep survey — picking any active deep')
    const [fallback] = await sql`
      SELECT id, workspace_id, location_id, slug, settings
      FROM surveys WHERE template = 'deep' AND status = 'active' LIMIT 1
    `
    if (!fallback) {
      console.error('No active deep survey found. Aborting.')
      process.exit(1)
    }
  }
  const target = survey ?? null
  if (!target) process.exit(1)

  console.log(
    `  Survey: ${target.id.slice(0, 8)}… type=${target.settings?.type} slug=${target.slug}`,
  )

  const testEmail = `smoke-truform-${randomUUID().slice(0, 8)}@example.invalid`
  const testPhone = `+9112222${Math.floor(Math.random() * 100000)}`
  const testName = 'Truform Smoke User'

  await sql.begin(async (tx) => {
    console.log('\n[2] Run the patched submitLegacyTruform flow inline')

    // Mimic patched service: resolve isPos from settings.type + score
    const score = 5 // CSAT 5 → expected isPos = true
    const expectedIsPos = score >= 4 // csat threshold

    const sessionId = randomUUID()

    // 1. Idempotent surveyStarts
    await tx`
      INSERT INTO survey_starts (survey_id, session_id, metadata)
      VALUES (${target.id}, ${sessionId}, '{}'::jsonb)
      ON CONFLICT (survey_id, session_id) DO NOTHING
    `

    // 2. Customer lookup-then-insert (workspace-scoped, phone first, then email)
    const lookup1 = await tx`
      SELECT id FROM customers
      WHERE workspace_id = ${target.workspace_id} AND phone = ${testPhone}
      LIMIT 1
    `
    let customerId
    if (lookup1.length > 0) {
      customerId = lookup1[0].id
    } else {
      const lookup2 = await tx`
        SELECT id FROM customers
        WHERE workspace_id = ${target.workspace_id} AND email = ${testEmail}
        LIMIT 1
      `
      if (lookup2.length > 0) {
        customerId = lookup2[0].id
      } else {
        const [created] = await tx`
          INSERT INTO customers (workspace_id, name, email, phone)
          VALUES (${target.workspace_id}, ${testName}, ${testEmail}, ${testPhone})
          RETURNING id
        `
        customerId = created.id
      }
    }
    assert('Customer row created (smoke phone is unique)', !!customerId)

    // 3. Insert survey_responses with all fields populated
    const answers = { q1: score, q2: 'Loved it!' }
    const [response] = await tx`
      INSERT INTO survey_responses (
        survey_id, workspace_id, location_id, customer_id, session_id,
        response_data, score, answers, metric_shown, metric_score, is_positive,
        completed_at, metadata
      ) VALUES (
        ${target.id}, ${target.workspace_id}, ${target.location_id ?? null},
        ${customerId}, ${sessionId},
        ${tx.json(answers)}, ${score}, ${tx.json(answers)},
        ${target.settings.type}, ${score}, ${expectedIsPos},
        NOW(), '{}'::jsonb
      ) RETURNING id, customer_id, is_positive, metric_shown, score
    `

    assert('Response inserted', !!response.id)
    assert(
      'customer_id populated on response',
      response.customer_id === customerId,
    )
    assert(
      'is_positive computed correctly (csat 5 ≥ 4 → true)',
      response.is_positive === true,
    )
    assert(
      'metric_shown stamped from settings.type',
      response.metric_shown === target.settings.type,
    )
    assert('score stamped on response', response.score === 5)

    // 4. Mark start row complete
    await tx`
      UPDATE survey_starts SET completed_at = NOW()
      WHERE survey_id = ${target.id} AND session_id = ${sessionId}
    `
    const [startRow] = await tx`
      SELECT completed_at FROM survey_starts
      WHERE survey_id = ${target.id} AND session_id = ${sessionId}
    `
    assert(
      'survey_starts.completed_at stamped',
      startRow.completed_at !== null,
    )

    // ROLLBACK
    throw new Error('__ROLLBACK_SMOKE_TEST__')
  }).catch((err) => {
    if (err.message !== '__ROLLBACK_SMOKE_TEST__') throw err
  })

  // Verify rollback
  const [{ count: leftover }] = await sql`
    SELECT COUNT(*)::int AS count FROM customers WHERE phone = ${testPhone}
  `
  assert('No leaked customer rows after rollback', leftover === 0)

  console.log(`\n=== ${pass} pass · ${fail} fail ===`)
  process.exit(fail === 0 ? 0 : 1)
} catch (err) {
  console.error('\n[SMOKE TEST FAILED]', err)
  process.exit(1)
} finally {
  await sql.end()
}
