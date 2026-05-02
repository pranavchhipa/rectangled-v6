import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { connectorInstances } from './connectors'
import { customers } from './customers'
import { users } from './users'

/** Reviews aggregated from external platforms */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .references(() => locations.id, { onDelete: 'cascade' }),
    connectorInstanceId: uuid('connector_instance_id').references(
      () => connectorInstances.id,
      { onDelete: 'set null' }
    ),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    platform: varchar('platform', { length: 50 }).notNull(), // 'google', 'zomato'
    platformReviewId: varchar('platform_review_id', { length: 255 }).notNull(),
    reviewerName: varchar('reviewer_name', { length: 255 }),
    reviewerAvatarUrl: text('reviewer_avatar_url'),
    rating: integer('rating').notNull(), // 1-5
    text: text('text'),
    reviewedAt: timestamp('reviewed_at').notNull(),
    language: varchar('language', { length: 10 }).default('en'),
    sentiment: varchar('sentiment', { length: 20 }), // positive, negative, neutral, mixed
    sentimentScore: real('sentiment_score'), // -1.0 to 1.0
    themes: text('themes').array(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    source: varchar('source', { length: 20 }).default('online').notNull(),
    // Phase 5 — journey_response_id column dropped (migration 0015).
    // Cross-reference via reviews.metadata.surveyResponseId
    // (set by the survey engine on offline-review creation).
    aspectTags: text('aspect_tags').array(),
    isEscalated: boolean('is_escalated').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reviews_platform_unique').on(
      table.workspaceId,
      table.platform,
      table.platformReviewId
    ),
  ]
)

/** AI-generated or human-written responses to reviews */
export const reviewResponses = pgTable('review_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, approved, posted, rejected
  generatedBy: varchar('generated_by', { length: 20 }).default('ai').notNull(), // ai, human
  aiModel: varchar('ai_model', { length: 100 }),
  approvedBy: uuid('approved_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  postedAt: timestamp('posted_at'),
  platformResponseId: varchar('platform_response_id', { length: 255 }),
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
