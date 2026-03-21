import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { customers } from './customers'
import { reviews } from './reviews'
import { truformResponses } from './truforms'
import { journeyResponses } from './journeys'
import { emotionClusterEnum, emotionPolarityEnum, nevSourceEnum } from './enums'

/** Predefined emotion definitions (seeded) */
export const emotionDefinitions = pgTable('emotion_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  cluster: emotionClusterEnum('cluster').notNull(),
  polarity: emotionPolarityEnum('polarity').notNull(),
  emoji: varchar('emoji', { length: 10 }).notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull(),
})

/** Individual NEV survey / NLP analysis responses */
export const nevResponses = pgTable('nev_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'set null',
  }),
  reviewId: uuid('review_id').references(() => reviews.id, {
    onDelete: 'set null',
  }),
  truformResponseId: uuid('truform_response_id').references(
    () => truformResponses.id,
    { onDelete: 'set null' }
  ),
  journeyResponseId: uuid('journey_response_id').references(
    () => journeyResponses.id,
    { onDelete: 'set null' }
  ),
  source: nevSourceEnum('source').notNull(),
  emotions: jsonb('emotions')
    .$type<Array<{ emotionId: string; intensity: number }>>()
    .notNull(),
  nevScore: real('nev_score').notNull(),
  rawText: text('raw_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
