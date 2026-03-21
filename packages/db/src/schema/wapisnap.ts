import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { locations } from './locations'
import { workspaces } from './workspaces'
import { customers } from './customers'
import {
  wapisnapNumberStatusEnum,
  wapisnapTemplateCategoryEnum,
  wapisnapTemplateStatusEnum,
  wapisnapMessageDirectionEnum,
  wapisnapMessageTypeEnum,
  wapisnapMessageStatusEnum,
  wapisnapSequenceStatusEnum,
} from './enums'

// Maps V6 locations to WapiSnap bridge workspaces
export const wapisnapWorkspaces = pgTable('wapisnap_workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id')
    .notNull()
    .unique()
    .references(() => locations.id, { onDelete: 'cascade' }),
  workspaceId: varchar('workspace_id', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 512 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  numberStatus: wapisnapNumberStatusEnum('number_status').default('pending').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  provisionedAt: timestamp('provisioned_at').defaultNow().notNull(),
  lastHealthCheck: timestamp('last_health_check'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// WhatsApp message templates
export const wapisnapTemplates = pgTable('wapisnap_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  wapisnapWorkspaceId: uuid('wapisnap_workspace_id')
    .notNull()
    .references(() => wapisnapWorkspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  category: wapisnapTemplateCategoryEnum('category').notNull(),
  status: wapisnapTemplateStatusEnum('status').default('PENDING').notNull(),
  components: jsonb('components').$type<Record<string, unknown>[]>().default([]).notNull(),
  metaTemplateId: varchar('meta_template_id', { length: 255 }),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Message tracking
export const wapisnapMessages = pgTable('wapisnap_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  wapisnapWorkspaceId: uuid('wapisnap_workspace_id')
    .notNull()
    .references(() => wapisnapWorkspaces.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 20 }).notNull(),
  direction: wapisnapMessageDirectionEnum('direction').notNull(),
  type: wapisnapMessageTypeEnum('type').notNull(),
  templateName: varchar('template_name', { length: 255 }),
  variables: jsonb('variables').$type<Record<string, unknown>>(),
  status: wapisnapMessageStatusEnum('status').default('queued').notNull(),
  metaMessageId: varchar('meta_message_id', { length: 255 }),
  errorMessage: varchar('error_message', { length: 1000 }),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Multi-step messaging sequences (V6's own scheduler)
export const wapisnapSequences = pgTable('wapisnap_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  phone: varchar('phone', { length: 20 }).notNull(),
  status: wapisnapSequenceStatusEnum('status').default('active').notNull(),
  steps: jsonb('steps')
    .$type<
      Array<{
        action: string
        templateName?: string
        variables?: Record<string, unknown>
        text?: string
        delayAfter: number // minutes
        executedAt?: string
      }>
    >()
    .default([])
    .notNull(),
  currentStep: integer('current_step').default(0).notNull(),
  nextExecuteAt: timestamp('next_execute_at'),
  cancelledAt: timestamp('cancelled_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
