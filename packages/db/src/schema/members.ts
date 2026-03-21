import { pgTable, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { roleEnum } from './enums'
import { users } from './users'
import { workspaces } from './workspaces'

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    locationIds: uuid('location_ids').array().default([]).notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('members_user_workspace_idx').on(table.userId, table.workspaceId)]
)
