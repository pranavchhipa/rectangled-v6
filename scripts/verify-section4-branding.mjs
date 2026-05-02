// One-shot §4 verification — call getPublicLegacyJourney +
// getPublicLegacyTruform for three real prod surveys (one per template
// that uses the legacy shim) and dump the branding payload.
//
// This is NOT a smoke test; it's a one-shot inspection so we can
// confirm the response shape end-to-end before shipping. Read-only.

import 'reflect-metadata'
import { SurveyEngineService } from '../apps/api/dist/surveys/survey-engine.service.js'
import { AdaptiveEngineService } from '../apps/api/dist/surveys/adaptive-engine.service.js'
import { createDb } from '../packages/db/dist/index.js'
import postgres from 'postgres'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const db = createDb(process.env.DATABASE_URL)
const adaptive = new AdaptiveEngineService(db)
const engine = new SurveyEngineService(db, adaptive)

try {
  // One sample per template that uses the legacy shim (j/{slug} or f/{slug}).
  const samples = await sql`
    SELECT DISTINCT ON (template) slug, template, name
    FROM surveys
    WHERE status = 'active' AND template IN ('adaptive', 'quick', 'deep')
    ORDER BY template, created_at DESC
  `
  for (const s of samples) {
    console.log('\n─'.padEnd(60, '─'))
    console.log(`[${s.template}] ${s.name}  (slug=${s.slug})`)
    try {
      const result =
        s.template === 'deep'
          ? await engine.getPublicLegacyTruform({ slug: s.slug })
          : await engine.getPublicLegacyJourney({ slug: s.slug })
      console.log('  branding:')
      for (const [k, v] of Object.entries(result.branding ?? {})) {
        console.log(`    ${k}: ${JSON.stringify(v)}`)
      }
      const fields = ['displayName', 'logoUrl', 'brandColor', 'workspaceName', 'poweredByText']
      const missing = fields.filter((f) => !(f in (result.branding ?? {})))
      if (missing.length === 0) {
        console.log('  ✓ all 5 branding fields present')
      } else {
        console.log(`  ✗ missing fields: ${missing.join(', ')}`)
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
  }
} finally {
  await sql.end()
}
