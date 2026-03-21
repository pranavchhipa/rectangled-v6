import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { connectorInstances } from './connectors'
import { users } from './users'

export const businessListings = pgTable('business_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  connectorInstanceId: uuid('connector_instance_id')
    .notNull()
    .references(() => connectorInstances.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 50 }).notNull(),
  platformListingId: varchar('platform_listing_id', { length: 255 }),
  name: varchar('name', { length: 255 }),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  website: text('website'),
  categories: text('categories').array(),
  hours: jsonb('hours').$type<Record<string, unknown>>().default({}).notNull(),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().default({}).notNull(),
  lastSyncedData: jsonb('last_synced_data').$type<Record<string, unknown>>().default({}).notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const listingChangeLog = pgTable('listing_change_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => businessListings.id, { onDelete: 'cascade' }),
  field: varchar('field', { length: 100 }).notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  changeSource: varchar('change_source', { length: 50 }),
  isAuthorized: boolean('is_authorized'),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const listingPosts = pgTable('listing_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  connectorInstanceId: uuid('connector_instance_id').references(
    () => connectorInstances.id,
    { onDelete: 'set null' }
  ),
  type: varchar('type', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  ctaType: varchar('cta_type', { length: 50 }),
  ctaUrl: text('cta_url'),
  publishedAt: timestamp('published_at'),
  platformPostId: varchar('platform_post_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
