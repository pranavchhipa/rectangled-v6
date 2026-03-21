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
import { truformResponses } from './truforms'
import { journeyResponses } from './journeys'

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
  truformResponseId: uuid('truform_response_id').references(
    () => truformResponses.id,
    { onDelete: 'set null' }
  ),
  journeyResponseId: uuid('journey_response_id').references(
    () => journeyResponses.id,
    { onDelete: 'set null' }
  ),
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
