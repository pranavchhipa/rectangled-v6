/**
 * Phase 4 verification — confirms the legacy table freeze is in effect.
 *
 * Checks:
 *   1. The four BEFORE INSERT/UPDATE triggers exist (raise_legacy_table_frozen).
 *   2. A test INSERT into each legacy table is blocked.
 *   3. Reports the most recent created_at across each legacy table — useful
 *      for spotting any rows that snuck in via a migration before 0013 was
 *      applied (or via a pg superuser bypassing triggers, which is on us
 *      to police).
 *
 * Run with:
 *   DATABASE_URL=... node scripts/verify-legacy-frozen.mjs
 */
import postgres from 'postgres'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

const TABLES = ['journeys', 'truforms', 'journey_responses', 'truform_responses']

let pass = 0
let fail = 0

function ok(label) {
  console.log(`  ✓ ${label}`)
  pass++
}
function bad(label, detail) {
  console.log(`  ✗ ${label}${detail ? `\n    ${detail}` : ''}`)
  fail++
}

try {
  // ─── 1. Trigger existence ──────────────────────────────────────────
  console.log('\n[1/3] Trigger existence')
  for (const t of TABLES) {
    const trig = await sql`
      SELECT tgname FROM pg_trigger
      WHERE tgname = ${'legacy_frozen_' + t}
        AND tgrelid = ${t}::regclass
        AND NOT tgisinternal
    `
    if (trig.length === 1) {
      ok(`trigger legacy_frozen_${t} exists on ${t}`)
    } else {
      bad(`trigger legacy_frozen_${t} missing on ${t}`)
    }
  }

  // ─── 2. INSERT is actually blocked ─────────────────────────────────
  console.log('\n[2/3] INSERT is blocked')
  // We use a CTE to build a phantom row that satisfies NOT NULLs but never
  // commits — the trigger fires before that anyway.
  for (const t of TABLES) {
    let blocked = false
    let errMsg = ''
    try {
      // Each table has different NOT NULLs; we only care that the trigger
      // fires before the constraint check, so NULL is OK to pass — the
      // trigger raises first.
      if (t === 'journeys') {
        await sql`INSERT INTO journeys (id, workspace_id, name, slug) VALUES (gen_random_uuid(), gen_random_uuid(), 'phase-4-probe', 'phase-4-probe-' || gen_random_uuid()::text)`
      } else if (t === 'truforms') {
        await sql`INSERT INTO truforms (id, workspace_id, name, slug, type) VALUES (gen_random_uuid(), gen_random_uuid(), 'phase-4-probe', 'phase-4-probe-' || gen_random_uuid()::text, 'csat'::truform_type)`
      } else if (t === 'journey_responses') {
        await sql`INSERT INTO journey_responses (id, journey_id, session_id, response_data) VALUES (gen_random_uuid(), gen_random_uuid(), 'phase-4-probe', '{}'::jsonb)`
      } else if (t === 'truform_responses') {
        await sql`INSERT INTO truform_responses (id, truform_id, answers, metadata) VALUES (gen_random_uuid(), gen_random_uuid(), '{}'::jsonb, '{}'::jsonb)`
      }
    } catch (err) {
      blocked = true
      errMsg = err.message ?? ''
    }
    if (blocked && errMsg.includes('frozen as of Phase 4')) {
      ok(`${t} INSERT blocked with Phase 4 message`)
    } else if (blocked) {
      bad(`${t} INSERT blocked but with unexpected error`, errMsg.slice(0, 120))
    } else {
      bad(`${t} INSERT succeeded — trigger NOT firing`)
    }
  }

  // ─── 3. Most-recent row timestamps ─────────────────────────────────
  console.log('\n[3/3] Most-recent created_at per legacy table (informational)')
  for (const t of TABLES) {
    const [{ count, latest }] = await sql`
      SELECT COUNT(*)::int AS count, MAX(created_at) AS latest FROM ${sql(t)}
    `
    console.log(`  ${t.padEnd(20)} ${String(count).padStart(6)} rows  · latest: ${latest ?? '(none)'}`)
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===\n`)
  process.exit(fail === 0 ? 0 : 1)
} catch (err) {
  console.error('\n[VERIFY FAILED]', err)
  process.exit(1)
} finally {
  await sql.end()
}
