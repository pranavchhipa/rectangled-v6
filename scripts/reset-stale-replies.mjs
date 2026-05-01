/**
 * One-shot fix: when a reply was deleted on GBP directly (or the original
 * reply never actually posted due to the pre-fix bug), the review_responses
 * row in our DB is still status='posted' but Google has nothing. The inbox
 * UI then hides the reply button.
 *
 * This script flips any 'posted' / 'approved' rows whose review's GBP reply
 * is missing back to 'deleted', so the inbox surfaces the reply control again.
 *
 * Run: DATABASE_URL=... node scripts/reset-stale-replies.mjs
 *
 * Note: this is the cheap version — it just resets ALL posted responses
 * older than the most recent sync. The proper fix (sync GBP reply state
 * in performSync) is now in apps/api/src/review/review.service.ts; this
 * script is for pre-sync data cleanup.
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
  // Show what we're about to do
  const candidates = await sql`
    SELECT rr.id, rr.review_id, rr.status, rr.content, r.reviewer_name, r.platform
    FROM review_responses rr
    JOIN reviews r ON r.id = rr.review_id
    WHERE rr.status IN ('posted', 'approved')
    ORDER BY rr.created_at DESC
  `

  if (candidates.length === 0) {
    console.log('No posted/approved responses to inspect.')
    process.exit(0)
  }

  console.log(`Found ${candidates.length} posted/approved response(s):`)
  for (const c of candidates) {
    console.log(`  - [${c.status.padEnd(8)}] ${c.platform.padEnd(8)} ${c.reviewer_name ?? '?'}: "${(c.content ?? '').slice(0, 60)}..."`)
  }

  const arg = process.argv[2]
  if (arg !== '--reset-all') {
    console.log('\nDry run. To actually reset all of these to status="deleted":')
    console.log('  node scripts/reset-stale-replies.mjs --reset-all')
    console.log('\nOr trigger a GBP sync (Inbox → Sync Reviews) to reconcile state automatically.')
    process.exit(0)
  }

  const result = await sql`
    UPDATE review_responses
    SET status = 'deleted', updated_at = NOW()
    WHERE status IN ('posted', 'approved')
  `
  console.log(`\n✓ Reset ${result.count} response(s) to status='deleted'.`)
  console.log('Inbox will now offer Reply / AI Generate on those reviews again.')
} finally {
  await sql.end()
}
