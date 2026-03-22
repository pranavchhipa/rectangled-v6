import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  date,
  real,
  integer,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { users } from './users'
import { socialPlatformEnum, contentTypeEnum, socialPostStatusEnum } from './enums'

// ---------------------------------------------------------------------------
// Social Posts — Generated social media content
// ---------------------------------------------------------------------------

export const socialPosts = pgTable('social_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'set null',
  }),
  platform: socialPlatformEnum('platform').notNull(),
  contentType: contentTypeEnum('content_type').notNull(),
  caption: text('caption').notNull(),
  hashtags: text('hashtags')
    .array()
    .default([])
    .notNull(),
  imagePrompt: text('image_prompt'),
  imageUrl: varchar('image_url', { length: 2048 }),
  status: socialPostStatusEnum('status').default('draft').notNull(),
  scheduledFor: timestamp('scheduled_for'),
  publishedAt: timestamp('published_at'),
  aiModel: varchar('ai_model', { length: 100 }),
  aiPromptUsed: text('ai_prompt_used'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// Content Calendar — Content planning
// ---------------------------------------------------------------------------

export type CalendarSlot = {
  time: string
  postId: string | null
  platform: string
  status: string
}

export const contentCalendar = pgTable('content_calendar', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  slots: jsonb('slots').$type<CalendarSlot[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// Brand Voice — Brand voice profiles per workspace
// ---------------------------------------------------------------------------

export const brandVoice = pgTable('brand_voice', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  tone: varchar('tone', { length: 50 }).default('professional').notNull(),
  keywords: text('keywords')
    .array()
    .default([])
    .notNull(),
  avoidWords: text('avoid_words')
    .array()
    .default([])
    .notNull(),
  samplePosts: text('sample_posts')
    .array()
    .default([])
    .notNull(),
  industry: varchar('industry', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// RAIS Credits — Credit system per workspace
// ---------------------------------------------------------------------------

export const raisCredits = pgTable('rais_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  totalCredits: real('total_credits').notNull().default(100),
  usedCredits: real('used_credits').notNull().default(0),
  lastResetAt: timestamp('last_reset_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// RAIS Credit Log — Transaction history
// ---------------------------------------------------------------------------

export const raisCreditLog = pgTable('rais_credit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(),
  creditsUsed: real('credits_used').notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// RAIS Analysis — Review analysis results
// ---------------------------------------------------------------------------

export const raisAnalysis = pgTable('rais_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id),
  periodMonths: integer('period_months').notNull().default(3),
  reviewsAnalyzed: integer('reviews_analyzed').notNull().default(0),
  positiveAspects: jsonb('positive_aspects')
    .$type<Array<{ aspect: string; count: number; sentiment: number; sampleReviews: string[] }>>()
    .default([]),
  topThemes: jsonb('top_themes')
    .$type<Array<{ theme: string; frequency: number; keywords: string[] }>>()
    .default([]),
  overallSentiment: real('overall_sentiment').default(0),
  aiSummary: text('ai_summary'),
  createdAt: timestamp('created_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// RAIS Post Ideas — Generated post ideas from analysis
// ---------------------------------------------------------------------------

export const raisPostIdeas = pgTable('rais_post_ideas', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id')
    .notNull()
    .references(() => raisAnalysis.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  ideas: jsonb('ideas')
    .$type<Array<{
      title: string
      subtitle: string
      description: string
      hashtags: string[]
      viralityAngle: string
      targetPlatform: string
    }>>()
    .default([]),
  createdAt: timestamp('created_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// RAIS Generated Posts — Final generated post output
// ---------------------------------------------------------------------------

export const raisGeneratedPosts = pgTable('rais_generated_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  ideaId: uuid('idea_id').references(() => raisPostIdeas.id),
  imageUrl: varchar('image_url', { length: 2048 }),
  imagePrompt: text('image_prompt'),
  title: varchar('title', { length: 500 }),
  description: text('description'),
  hashtags: text('hashtags').array().default([]),
  platform: varchar('platform', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  scheduledFor: timestamp('scheduled_for'),
  aiRecommendedTime: varchar('ai_recommended_time', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
