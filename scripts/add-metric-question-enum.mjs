/**
 * Surgical fix: add 'metric_question' to the screen_type enum on production.
 *
 * Avoids `drizzle-kit push` because that wants to drop hundreds of NOT NULL
 * constraints (drizzle-kit introspection bug). This script only adds the
 * one enum value we need.
 */
import postgres from 'postgres'
import 'dotenv/config'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1 })

try {
  // Check if value already exists
  const existing = await sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'screen_type')
  `
  const labels = existing.map((r) => r.enumlabel)
  console.log('Current screen_type values:', labels.join(', '))

  if (labels.includes('metric_question')) {
    console.log('✓ metric_question already exists — nothing to do.')
  } else {
    console.log('→ Adding metric_question…')
    await sql.unsafe(`ALTER TYPE "public"."screen_type" ADD VALUE 'metric_question'`)
    console.log('✓ Added metric_question to screen_type enum.')
  }
} catch (err) {
  console.error('FAILED:', err.message)
  process.exit(1)
} finally {
  await sql.end()
}
