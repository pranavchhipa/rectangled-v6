import { pgTable, uuid, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const onboardingState = pgTable('onboarding_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  currentStep: integer('current_step').default(0).notNull(),
  completedSteps: jsonb('completed_steps').$type<number[]>().default([]).notNull(),
  isComplete: boolean('is_complete').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
