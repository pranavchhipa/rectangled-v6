import {
  pgTable,
  uuid,
  varchar,
  real,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { customers } from './customers'
// Phase 5 — truformResponses + journeyResponses tables dropped.
// truform_response_id / journey_response_id columns kept as orphan UUIDs
// for historical analytics; cross-reference via survey_responses.legacy_*_response_id.

/** Customer Loyalty Index responses */
export const cliResponses = pgTable('cli_responses', {
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
  // Phase 5 — orphan UUIDs (no FK). See note at top of file.
  truformResponseId: uuid('truform_response_id'),
  journeyResponseId: uuid('journey_response_id'),
  trustScore: real('trust_score').notNull(), // 1-10
  satisfactionScore: real('satisfaction_score').notNull(), // 1-10
  advocacyScore: real('advocacy_score').notNull(), // 0-10
  cliScore: real('cli_score').notNull(), // 0-100
  segment: varchar('segment', { length: 20 }).notNull(), // champion, loyalist, passive, at_risk, detractor
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
