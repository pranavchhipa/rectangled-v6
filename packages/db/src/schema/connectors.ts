import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { bindingLevelEnum, connectorStatusEnum } from './enums'
import { workspaces } from './workspaces'
import { locations } from './locations'

/** Registry of available connector types (seeded data) */
export const connectorTypes = pgTable('connector_types', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  authType: varchar('auth_type', { length: 50 }).notNull(),
  bindingLevel: bindingLevelEnum('binding_level').notNull(),
  configSchema: jsonb('config_schema').$type<Record<string, unknown>>().default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
})

/** Instances of connected integrations per workspace/location */
export const connectorInstances = pgTable('connector_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectorTypeId: varchar('connector_type_id', { length: 50 })
    .notNull()
    .references(() => connectorTypes.id),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'cascade' }),
  credentials: jsonb('credentials').$type<Record<string, unknown>>().default({}).notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
  status: connectorStatusEnum('status').default('pending').notNull(),
  lastHealthCheck: timestamp('last_health_check'),
  lastSyncAt: timestamp('last_sync_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
