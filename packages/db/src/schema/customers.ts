import { pgTable, uuid, varchar, text, integer, real, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    tags: text('tags').array().default([]).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    totalReviews: integer('total_reviews').default(0).notNull(),
    averageRating: real('average_rating'),
    status: varchar('status', { length: 20 }).default('new').notNull(),
    firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('customers_workspace_phone_idx')
      .on(table.workspaceId, table.phone),
    uniqueIndex('customers_workspace_email_idx')
      .on(table.workspaceId, table.email),
  ]
)
