// Hotfix-2 diagnostics — 4 bugs from prod smoke test.
//
// Q1: Test4 row shape — workspaceId, locationId, template, mode,
//     legacy_truform_id, settings keys.
// Q2: Test4's location row — does it exist? city/state/displayName?
// Q3: Workspace branding fields for Test4's workspace.
// Q4: Survey count by template (so we know which templates exist).
//
// Read-only.

import postgres from 'postgres'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

function header(s) {
  console.log('\n' + '─'.repeat(72))
  console.log(s)
  console.log('─'.repeat(72))
}

try {
  header('Q1 — Test4 survey row (slug f-45f73fc6-f)')
  const [test4] = await sql`
    SELECT id, name, slug, template, mode, status,
           workspace_id, location_id,
           legacy_journey_id, legacy_truform_id,
           settings
    FROM surveys
    WHERE slug = 'f-45f73fc6-f'
    LIMIT 1
  `
  if (!test4) {
    console.log('  Test4 not found by slug f-45f73fc6-f')
  } else {
    console.log(`  id:                 ${test4.id}`)
    console.log(`  name:               ${test4.name}`)
    console.log(`  slug:               ${test4.slug}`)
    console.log(`  template:           ${test4.template}`)
    console.log(`  mode:               ${test4.mode}`)
    console.log(`  status:             ${test4.status}`)
    console.log(`  workspace_id:       ${test4.workspace_id}`)
    console.log(`  location_id:        ${test4.location_id ?? '(null — not bound)'}`)
    console.log(`  legacy_journey_id:  ${test4.legacy_journey_id ?? '(null)'}`)
    console.log(`  legacy_truform_id:  ${test4.legacy_truform_id ?? '(null)'}`)
    console.log(`  settings keys:      ${JSON.stringify(Object.keys(test4.settings ?? {}))}`)
  }

  header('Q2 — Test4 location row (if bound)')
  if (test4?.location_id) {
    const [loc] = await sql`
      SELECT id, name, city, state, display_name, logo_url, brand_color
      FROM locations WHERE id = ${test4.location_id}
    `
    if (!loc) {
      console.log(`  Location ${test4.location_id} NOT FOUND — orphaned reference!`)
    } else {
      console.log(`  id:           ${loc.id}`)
      console.log(`  name:         ${loc.name}`)
      console.log(`  city:         ${loc.city ?? '(null)'}`)
      console.log(`  state:        ${loc.state ?? '(null)'}`)
      console.log(`  display_name: ${loc.display_name ?? '(null)'}`)
      console.log(`  logo_url:     ${loc.logo_url ?? '(null)'}`)
      console.log(`  brand_color:  ${loc.brand_color ?? '(null)'}`)
    }
  } else {
    console.log('  Test4 has no location_id — not bound to any location.')
    console.log('  → branding falls back to workspace.name only (no compose).')
  }

  header('Q3 — Workspace row for Test4 + count of locations under it')
  if (test4?.workspace_id) {
    const [ws] = await sql`
      SELECT id, name, logo_url, brand_colors,
             (SELECT COUNT(*)::int FROM locations WHERE workspace_id = workspaces.id) AS location_count
      FROM workspaces WHERE id = ${test4.workspace_id}
    `
    console.log(`  workspace.name:        ${ws.name}`)
    console.log(`  workspace.logo_url:    ${ws.logo_url ?? '(null)'}`)
    console.log(`  workspace.brand_colors: ${JSON.stringify(ws.brand_colors)}`)
    console.log(`  workspace location_count: ${ws.location_count}`)
  }

  header('Q4 — All Test* surveys for context')
  const tests = await sql`
    SELECT id, name, slug, template, mode, location_id, legacy_truform_id
    FROM surveys
    WHERE name ILIKE 'test%'
    ORDER BY name
  `
  for (const t of tests) {
    console.log(
      `  ${t.name.padEnd(12)} ${t.slug.padEnd(20)} ${t.template.padEnd(10)} ${t.mode.padEnd(12)} loc=${t.location_id ? 'bound' : 'null'} legacyTF=${t.legacy_truform_id ? 'set' : 'null'}`,
    )
  }
} finally {
  await sql.end()
}
