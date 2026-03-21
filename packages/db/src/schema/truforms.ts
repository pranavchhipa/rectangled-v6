import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { customers } from './customers'
import { truformTypeEnum, truformStatusEnum } from './enums'

export const truforms = pgTable('truforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'cascade',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  type: truformTypeEnum('type').notNull(),
  status: truformStatusEnum('status').default('draft').notNull(),
  config: jsonb('config')
    .$type<{
      questions: Array<{
        id: string
        type: string
        title: string
        options?: unknown[]
        required?: boolean
      }>
      branding: Record<string, unknown>
      thankYouMessage: string
    }>()
    .default({ questions: [], branding: {}, thankYouMessage: 'Thank you for your feedback!' })
    .notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const truformResponses = pgTable('truform_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  truformId: uuid('truform_id')
    .notNull()
    .references(() => truforms.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  score: integer('score'),
  answers: jsonb('answers').$type<Record<string, unknown>>().default({}).notNull(),
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
