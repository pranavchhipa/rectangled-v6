import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { reviews } from './reviews'
import { locations } from './locations'
import { customers } from './customers'
import {
  triggerTypeEnum,
  escalationPriorityEnum,
  escalationStatusEnum,
} from './enums'

/** Rules that determine when and how reviews/complaints are escalated */
export const escalationRules = pgTable('escalation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  triggerType: triggerTypeEnum('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  assignToUserId: uuid('assign_to_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  assignToRole: varchar('assign_to_role', { length: 50 }),
  priority: escalationPriorityEnum('priority').default('medium').notNull(),
  slaMinutes: integer('sla_minutes'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/** Individual escalation instances created when rules are triggered */
export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').references(() => escalationRules.id, {
    onDelete: 'set null',
  }),
  reviewId: uuid('review_id').references(() => reviews.id, {
    onDelete: 'set null',
  }),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'set null',
  }),
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  status: escalationStatusEnum('status').default('open').notNull(),
  priority: escalationPriorityEnum('priority').default('medium').notNull(),
  slaDeadline: timestamp('sla_deadline'),
  slaBreached: boolean('sla_breached').default(false).notNull(),
  notes: text('notes'),
  ticketNumber: integer('ticket_number'),
  activityLog: jsonb('activity_log').$type<Array<{ text: string; authorId: string; authorName: string; timestamp: string }>>().default([]).notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
