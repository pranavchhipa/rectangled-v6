import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { users } from './users'
import { reportTypeEnum } from './enums'

export const reportSnapshots = pgTable('report_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  reportType: reportTypeEnum('report_type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  dateFrom: timestamp('date_from').notNull(),
  dateTo: timestamp('date_to').notNull(),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'set null',
  }),
  data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
  generatedByUserId: uuid('generated_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  shareToken: varchar('share_token', { length: 50 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
