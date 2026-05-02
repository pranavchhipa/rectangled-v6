// Hotfix PRD §4 — pre-flight diagnostics for Location Branding on Public Pages.
//
// Three questions:
//   A. Do locations.{logo_url, brand_color, display_name} already exist?
//      Expect: none. PRD §4.2 specifies these as fresh additions via
//      0021_location_branding.sql (idempotent IF NOT EXISTS).
//
//   B. Does workspaces.logo_url already exist? PRD §4.3 says "verify it
//      exists; if not, add it the same way." We need to know which.
//
//   C. Snapshot of current locations data — how many rows, how many
//      with images set anywhere (e.g. an existing image_url column,
//      brand_assets jsonb, etc.)? Catches alternative columns we'd
//      duplicate by adding a fresh `logo_url`.
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
  header('A. locations columns (looking for logo_url / brand_color / display_name)')
  const locationsCols = await sql`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations'
    ORDER BY ordinal_position
  `
  for (const r of locationsCols) {
    const len = r.character_maximum_length ? `(${r.character_maximum_length})` : ''
    console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}${len}`)
  }
  const targets = ['logo_url', 'brand_color', 'display_name']
  console.log('')
  for (const t of targets) {
    const present = locationsCols.some((c) => c.column_name === t)
    console.log(`  ${t.padEnd(20)} → ${present ? 'EXISTS' : 'missing'}`)
  }

  header('B. workspaces columns (looking for logo_url + settings shape)')
  const workspaceCols = await sql`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces'
    ORDER BY ordinal_position
  `
  for (const r of workspaceCols) {
    const len = r.character_maximum_length ? `(${r.character_maximum_length})` : ''
    console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}${len}`)
  }
  console.log('')
  console.log(
    `  logo_url             → ${workspaceCols.some((c) => c.column_name === 'logo_url') ? 'EXISTS' : 'missing'}`,
  )
  console.log(
    `  settings (jsonb)     → ${workspaceCols.some((c) => c.column_name === 'settings') ? 'EXISTS' : 'missing'}`,
  )

  header('C. locations data snapshot — row count + settings sniff')
  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM locations`
  console.log(`  total locations: ${total}`)
  const settingsKeys = await sql`
    SELECT DISTINCT jsonb_object_keys(settings) AS key
    FROM locations
    WHERE jsonb_typeof(settings) = 'object'
    ORDER BY key
  `
  if (settingsKeys.length === 0) {
    console.log('  no keys in any locations.settings (all empty/null)')
  } else {
    console.log(
      `  distinct keys in locations.settings: ${settingsKeys.map((r) => r.key).join(', ')}`,
    )
  }

  // Look for any columns in locations whose name suggests imagery/branding.
  const imageishCols = locationsCols.filter((c) =>
    /image|logo|brand|color|photo|icon|display/i.test(c.column_name),
  )
  console.log('')
  if (imageishCols.length === 0) {
    console.log("  no existing image/logo/brand/color/display columns on locations")
  } else {
    console.log("  existing branding-adjacent columns on locations:")
    for (const c of imageishCols) console.log(`    · ${c.column_name} (${c.data_type})`)
  }

  header('C2. workspaces.brand_colors — shape sniff (PRD references settings.brandColor)')
  const brandColorRows = await sql`
    SELECT id, name, brand_colors, settings->'brandColor' AS settings_brand_color
    FROM workspaces
    WHERE brand_colors <> '{}'::jsonb OR settings ? 'brandColor'
    LIMIT 6
  `
  if (brandColorRows.length === 0) {
    console.log('  no workspaces have brand_colors set or settings.brandColor — all rely on default')
  } else {
    for (const r of brandColorRows) {
      console.log(
        `  ${r.name.padEnd(28)} brand_colors=${JSON.stringify(r.brand_colors)} settings.brandColor=${JSON.stringify(r.settings_brand_color)}`,
      )
    }
  }

  header('D. organizations.white_label shape (PRD §4.4 references it)')
  const orgCols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
      AND (column_name LIKE '%white%' OR column_name LIKE '%label%' OR column_name LIKE '%brand%')
    ORDER BY ordinal_position
  `
  if (orgCols.length === 0) {
    console.log('  (no white_label / brand-named columns on organizations)')
  } else {
    for (const r of orgCols) {
      console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`)
    }
  }
} finally {
  await sql.end()
}
