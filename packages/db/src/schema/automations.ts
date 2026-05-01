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
import { organizations } from './organizations'
import { locations } from './locations'
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
  /**
   * Phase 0 Fix 4 — per-customer cooldown window in hours. NULL = no cooldown.
   * Engine skips enqueue if the same (rule, customer) was enqueued within the
   * window. Default 2160h (90 days) is set on existing send_coupon rules via
   * migration 0005.
   */
  cooldownHours: integer('cooldown_hours'),
  /**
   * Phase 2 — rule inheritance scope. Engine resolves precedence
   * `location > workspace > organization` per (triggerEvent, actionType).
   * Default 'workspace' preserves legacy behaviour.
   */
  scope: varchar('scope', { length: 20 }).default('workspace').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'cascade',
  }),
  /**
   * Informational self-FK — points from a location override back to the
   * workspace rule it overrides. Engine doesn't read this; it uses scope
   * precedence. UI uses this to render the inheritance chain.
   */
  overridesRuleId: uuid('overrides_rule_id'),
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
