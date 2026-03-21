import { pgTable, uuid, varchar, boolean, integer, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const businessAspects = pgTable('business_aspects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }),
  isDefault: boolean('is_default').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
