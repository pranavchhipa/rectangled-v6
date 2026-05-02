import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  integer,
  boolean,
  pgEnum,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { organizations } from './organizations'
import { customers } from './customers'

/**
 * Phase 3 — unified surveys.
 *
 *   template = 'quick'  → legacy Journey (single-screen, random metric, fast)
 *   template = 'deep'   → legacy TruForm (multi-question, deliberate)
 *   mode     = 'intelligent' → server-seeded steps, owner edits copy only
 *   mode     = 'builder'     → owner edits the step graph in React Flow
 *
 * Steps live in a single JSONB array per survey. The engine reads them at
 * public-page time and walks the graph based on the customer's answers.
 *
 * legacy_journey_id / legacy_truform_id link rows back to the source so
 * we can verify migration counts and roll back per-row if needed.
 */
// Hotfix §2 — 'adaptive' added for the dedicated v2 Adaptive Journey
// engine; 'custom' reserved for the §3 wizard-built manual journey.
export const surveyTemplateEnum = pgEnum('survey_template', [
  'quick',
  'deep',
  'adaptive',
  'custom',
])
export const surveyModeEnum = pgEnum('survey_mode', ['intelligent', 'builder'])
export const surveyStatusEnum = pgEnum('survey_status', ['draft', 'active', 'archived'])

export const surveys = pgTable(
  'surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'cascade',
    }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),

    template: surveyTemplateEnum('template').notNull(),
    mode: surveyModeEnum('mode').default('intelligent').notNull(),
    status: surveyStatusEnum('status').default('draft').notNull(),

    /**
     * Quick template:
     *   { enabledMetrics, thresholds, enableCoupon, reviewPlatform }
     * Deep template:
     *   { type: 'nps' | 'csat' | 'ces' | 'custom', branding, thankYou, ... }
     */
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),

    /**
     * The step graph — see `packages/shared/src/types/survey-steps.ts` for
     * the typed step union. `[]` for surveys that haven't been configured yet.
     */
    steps: jsonb('steps').$type<unknown[]>().default([]).notNull(),

    legacyJourneyId: uuid('legacy_journey_id'),
    legacyTruformId: uuid('legacy_truform_id'),

    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_surveys_workspace').on(t.workspaceId),
    index('idx_surveys_organization').on(t.organizationId),
    index('idx_surveys_location').on(t.locationId).where(sql`${t.locationId} IS NOT NULL`),
    index('idx_surveys_legacy_journey')
      .on(t.legacyJourneyId)
      .where(sql`${t.legacyJourneyId} IS NOT NULL`),
    index('idx_surveys_legacy_truform')
      .on(t.legacyTruformId)
      .where(sql`${t.legacyTruformId} IS NOT NULL`),
  ],
)

export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),

    sessionId: varchar('session_id', { length: 100 }).notNull(),
    responseData: jsonb('response_data').$type<Record<string, unknown>>().default({}).notNull(),

    // Hot-path columns for cheap analytics (avoid JSONB extracts).
    metricShown: varchar('metric_shown', { length: 20 }),
    metricScore: integer('metric_score'),
    isPositive: boolean('is_positive'),

    score: integer('score'),
    answers: jsonb('answers').$type<Record<string, unknown>>(),

    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    abandonedAt: timestamp('abandoned_at'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    legacyJourneyResponseId: uuid('legacy_journey_response_id'),
    legacyTruformResponseId: uuid('legacy_truform_response_id'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_survey_responses_survey').on(t.surveyId),
    index('idx_survey_responses_workspace').on(t.workspaceId),
    index('idx_survey_responses_location')
      .on(t.locationId)
      .where(sql`${t.locationId} IS NOT NULL`),
    index('idx_survey_responses_customer')
      .on(t.customerId)
      .where(sql`${t.customerId} IS NOT NULL`),
  ],
)

/**
 * Phase 3 — abandonment tracking. completed_at IS NULL after a threshold
 * means the visitor opened the survey but never finished. Closes the gap
 * where today only journeys produce abandonment data.
 */
export const surveyStarts = pgTable(
  'survey_starts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    sessionId: varchar('session_id', { length: 100 }).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    unique('uniq_survey_starts_session').on(t.surveyId, t.sessionId),
    index('idx_survey_starts_survey').on(t.surveyId),
    index('idx_survey_starts_abandoned')
      .on(t.surveyId, t.startedAt)
      .where(sql`${t.completedAt} IS NULL`),
  ],
)
