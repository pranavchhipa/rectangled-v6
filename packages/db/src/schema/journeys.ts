import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { customers } from './customers'
import { screenTypeEnum } from './enums'

export const journeys = pgTable('journeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'cascade',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  settings: jsonb('settings')
    .$type<{
      positiveThreshold: number
      enableCoupon: boolean
      reviewPlatform: string
    }>()
    .default({
      positiveThreshold: 4,
      enableCoupon: false,
      reviewPlatform: 'google',
    })
    .notNull(),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const journeyScreens = pgTable('journey_screens', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id')
    .notNull()
    .references(() => journeys.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  screenType: screenTypeEnum('screen_type').notNull(),
  title: text('title'),
  subtitle: text('subtitle'),
  config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
  branchConditions: jsonb('branch_conditions')
    .$type<
      Array<{
        field: string
        operator: string
        value?: unknown
        nextScreenId: string
      }>
    >()
    .default([])
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const journeyResponses = pgTable('journey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id')
    .notNull()
    .references(() => journeys.id, { onDelete: 'cascade' }),
  journeyScreenId: uuid('journey_screen_id').references(
    () => journeyScreens.id,
    { onDelete: 'set null' }
  ),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  responseData: jsonb('response_data')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
