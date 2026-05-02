// Hotfix PRD §3 — pre-flight diagnostics for the Wizard Custom Journey Builder.
//
// Three questions this script answers before we write any code:
//
//   1. Are there ANY surveys with template='custom' in production?
//      Expected: 0. If non-zero, those rows exist in a state we
//      haven't built code for yet — investigate before proceeding.
//
//   2. How many surveys have mode='builder' (i.e., active React Flow
//      canvas users)? Breakdown by template. Tells us whether the
//      step-graph engine has live in-prod usage we need to preserve.
//
//   3. Full template × mode matrix so we have a complete picture of
//      production survey state going into §3.
//
// Read-only. Safe to run anytime.

import postgres from 'postgres'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

function header(s) {
  console.log('\n' + '─'.repeat(64))
  console.log(s)
  console.log('─'.repeat(64))
}

try {
  header('Q1 — surveys with template=\'custom\' (expect 0)')
  const customRows = await sql`
    SELECT id, name, slug, mode, status, created_at,
           jsonb_array_length(steps) AS step_count
    FROM surveys
    WHERE template = 'custom'
    ORDER BY created_at DESC
  `
  console.log(`count: ${customRows.length}`)
  for (const r of customRows) {
    console.log(
      `  ${r.id} | ${(r.name ?? '').padEnd(30)} | ${r.slug.padEnd(20)} | mode=${r.mode} status=${r.status} steps=${r.step_count}`,
    )
  }

  header('Q2 — surveys with mode=\'builder\' (active React Flow canvas)')
  const builderRows = await sql`
    SELECT template, status,
           COUNT(*) AS count,
           SUM(CASE WHEN legacy_journey_id IS NOT NULL THEN 1 ELSE 0 END) AS with_legacy_journey,
           SUM(CASE WHEN legacy_truform_id IS NOT NULL THEN 1 ELSE 0 END) AS with_legacy_truform
    FROM surveys
    WHERE mode = 'builder'
    GROUP BY template, status
    ORDER BY template, status
  `
  if (builderRows.length === 0) {
    console.log('  (no surveys with mode=\'builder\')')
  } else {
    console.log('  template  | status   | count | w/legacy_journey | w/legacy_truform')
    for (const r of builderRows) {
      console.log(
        `  ${r.template.padEnd(9)} | ${r.status.padEnd(8)} | ${String(r.count).padStart(5)} | ${String(r.with_legacy_journey).padStart(16)} | ${String(r.with_legacy_truform).padStart(16)}`,
      )
    }
  }

  header('Q2b — same, but only rows with at least one response')
  const builderUsedRows = await sql`
    SELECT s.template, s.status,
           COUNT(DISTINCT s.id) AS surveys,
           COUNT(r.id) AS responses,
           MAX(r.created_at) AS last_response_at
    FROM surveys s
    JOIN survey_responses r ON r.survey_id = s.id
    WHERE s.mode = 'builder'
    GROUP BY s.template, s.status
    ORDER BY s.template, s.status
  `
  if (builderUsedRows.length === 0) {
    console.log('  (no builder-mode surveys have any responses)')
  } else {
    console.log('  template  | status   | surveys | responses | last_response_at')
    for (const r of builderUsedRows) {
      console.log(
        `  ${r.template.padEnd(9)} | ${r.status.padEnd(8)} | ${String(r.surveys).padStart(7)} | ${String(r.responses).padStart(9)} | ${r.last_response_at?.toISOString?.() ?? r.last_response_at ?? '—'}`,
      )
    }
  }

  header('Q3 — full template × mode matrix (sanity check on prod state)')
  const matrix = await sql`
    SELECT template, mode, status, COUNT(*) AS count
    FROM surveys
    GROUP BY template, mode, status
    ORDER BY template, mode, status
  `
  console.log('  template  | mode         | status   | count')
  for (const r of matrix) {
    console.log(
      `  ${r.template.padEnd(9)} | ${r.mode.padEnd(12)} | ${r.status.padEnd(8)} | ${String(r.count).padStart(5)}`,
    )
  }

  header('Q4 — distinct step types in use across all surveys.steps[*].type')
  const stepTypes = await sql`
    SELECT step->>'type' AS step_type,
           COUNT(*) AS step_instances,
           COUNT(DISTINCT s.id) AS surveys_using
    FROM surveys s,
         jsonb_array_elements(s.steps) step
    WHERE jsonb_typeof(s.steps) = 'array'
    GROUP BY step->>'type'
    ORDER BY step_instances DESC
  `
  if (stepTypes.length === 0) {
    console.log('  (no surveys with step arrays)')
  } else {
    console.log('  step_type            | instances | surveys_using')
    for (const r of stepTypes) {
      console.log(
        `  ${(r.step_type ?? 'NULL').padEnd(20)} | ${String(r.step_instances).padStart(9)} | ${String(r.surveys_using).padStart(13)}`,
      )
    }
  }
} finally {
  await sql.end()
}
