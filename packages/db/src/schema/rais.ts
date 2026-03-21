import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  date,
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
