import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  date,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { reviews } from './reviews'
import { locations } from './locations'

export const aiResponseSchedules = pgTable('ai_response_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp('scheduled_for').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const aiResponseDailyCounts = pgTable(
  'ai_response_daily_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    count: integer('count').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('ai_daily_counts_unique').on(table.locationId, table.date),
  ]
)
