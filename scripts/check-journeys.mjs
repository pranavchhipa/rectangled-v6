import postgres from 'postgres'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

try {
  const rows = await sql`
    SELECT id, slug, name, is_active, archived_at, settings,
           (SELECT COUNT(*) FROM journey_screens WHERE journey_id = j.id) AS screen_count,
           (SELECT screen_type::text FROM journey_screens WHERE journey_id = j.id ORDER BY "order" ASC LIMIT 1) AS first_screen_type
    FROM journeys j
    ORDER BY created_at DESC
    LIMIT 10
  `
  for (const r of rows) {
    const enabled = r.settings?.enabledMetrics
    console.log(
      `${r.slug.padEnd(15)} | ${(r.name ?? '').padEnd(20)} | active:${r.is_active ? 'Y' : 'N'} | archived:${r.archived_at ? 'Y' : 'N'} | screens:${r.screen_count} | first:${r.first_screen_type ?? 'NULL'} | enabledMetrics:${Array.isArray(enabled) ? enabled.join(',') : 'MISSING'}`,
    )
  }
} finally {
  await sql.end()
}
