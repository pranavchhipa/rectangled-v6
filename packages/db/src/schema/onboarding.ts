import { pgTable, uuid, integer, boolean, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const onboardingState = pgTable('onboarding_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  /**
   * Phase 1 — onboarding flow per organization type.
   *   'direct'         → linear single-business flow (existing behaviour)
   *   'multi_location' → bulk add locations + per-location GBP
   *   'agency'         → white-label setup → add clients
   * Step semantics differ per flow; the dashboard's onboarding component
   * branches on this. Default 'direct' keeps legacy behaviour.
   */
  flow: varchar('flow', { length: 20 }).default('direct').notNull(),
  currentStep: integer('current_step').default(0).notNull(),
  completedSteps: jsonb('completed_steps').$type<number[]>().default([]).notNull(),
  isComplete: boolean('is_complete').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
