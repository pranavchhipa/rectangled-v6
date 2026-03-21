import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { tonePresetEnum } from './enums'

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  industry: varchar('industry', { length: 100 }),
  logoUrl: text('logo_url'),
  brandColors: jsonb('brand_colors').$type<{
    primary: string
    secondary: string
    accent: string
  }>(),
  tonePreset: tonePresetEnum('tone_preset').default('professional').notNull(),
  settings: jsonb('settings')
    .$type<{
      defaultTimezone: string
      aiAutoRespond: boolean
      reviewResponseDelay: { min: number; max: number }
      frequencyCap: { maxSurveys: number; windowDays: number }
    }>()
    .default({
      defaultTimezone: 'Asia/Kolkata',
      aiAutoRespond: false,
      reviewResponseDelay: { min: 1, max: 3 },
      frequencyCap: { maxSurveys: 2, windowDays: 60 },
    })
    .notNull(),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
