import { pgTable, uuid, varchar, jsonb, integer, timestamp, text, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Phase 0 Fix 3 — system-internal async work queue.
 *
 * Distinct from automation_queue (which is user-facing, workspace/customer/
 * review-keyed and surfaced in the dashboard). This table is for plumbing —
 * escalation evaluation right now, future event-bus consumers (Phase 4),
 * etc.
 *
 * Design rules:
 * - Idempotent payloads: handlers must accept the same payload twice without
 *   side-effect drift. The worker may retry up to maxAttempts.
 * - No FK references to domain tables. Payloads carry IDs by value, so
 *   deleting a referenced row doesn't break a pending job; the handler
 *   no-ops if the source is gone.
 */
export const internalJobs = pgTable(
  'internal_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 100 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    scheduledFor: timestamp('scheduled_for').defaultNow().notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_internal_jobs_pending_due')
      .on(t.scheduledFor)
      .where(sql`${t.status} = 'pending'`),
    index('idx_internal_jobs_processing_stale')
      .on(t.updatedAt)
      .where(sql`${t.status} = 'processing'`),
  ],
)
