import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces'
import { journeys, journeyResponses } from './journeys'
import { customers } from './customers'
import { reviews } from './reviews'
import { automationTriggerEnum, automationActionEnum, automationQueueStatusEnum } from './enums'

export const automationRules = pgTable('automation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  journeyId: uuid('journey_id').references(() => journeys.id, {
    onDelete: 'cascade',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  triggerEvent: automationTriggerEnum('trigger_event').notNull(),
  delayMinutes: integer('delay_minutes').notNull(),
  actionType: automationActionEnum('action_type').notNull(),
  actionConfig: jsonb('action_config')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  conditions: jsonb('conditions').$type<Record<string, unknown>>(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const automationQueue = pgTable(
  'automation_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    journeyResponseId: uuid('journey_response_id').references(
      () => journeyResponses.id,
      { onDelete: 'set null' }
    ),
    reviewId: uuid('review_id').references(() => reviews.id, {
      onDelete: 'set null',
    }),
    /**
     * Deterministic key per (rule, source) for idempotent enqueue.
     * Format depends on triggerEvent — see apps/api/src/automation/triggerKey.ts.
     * Nullable so legacy rows and internal-jobs reuse don't conflict; the
     * unique index is partial.
     */
    triggerKey: varchar('trigger_key', { length: 255 }),
    scheduledFor: timestamp('scheduled_for').notNull(),
    status: automationQueueStatusEnum('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    completedAt: timestamp('completed_at'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    // Idempotency: one queue row per (rule, triggerKey). NULL keys excluded.
    uniqueIndex('idx_automation_queue_idempotency')
      .on(t.ruleId, t.triggerKey)
      .where(sql`${t.triggerKey} IS NOT NULL`),
  ]
)
