import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { tonePresetEnum } from './enums'
import { organizations } from './organizations'

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * Phase 1 — every workspace belongs to an organization. Backfilled in
   * migration 0008; tightened to NOT NULL in 0009. Cascade delete keeps
   * the workspace cleanup story unchanged from before (delete an org →
   * everything beneath cascades).
   */
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
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
      /**
       * Phase 0 Fix 8 — per-customer outbound rate caps. Worker checks
       * these before dispatching any send_coupon / send_message action.
       * Default seeded by migration 0005.
       */
      customerRateCap?: {
        maxMessagesPerDay?: number
        maxCouponsPerMonth?: number
        maxActionsPerWeek?: number
      }
    }>()
    .default({
      defaultTimezone: 'Asia/Kolkata',
      aiAutoRespond: false,
      reviewResponseDelay: { min: 1, max: 3 },
      frequencyCap: { maxSurveys: 2, windowDays: 60 },
      customerRateCap: {
        maxMessagesPerDay: 3,
        maxCouponsPerMonth: 1,
        maxActionsPerWeek: 10,
      },
    })
    .notNull(),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  /**
   * Phase 1 — agency-mode metadata about the client this workspace
   * represents. Empty `{}` for direct and multi_location orgs. Schema:
   *   {
   *     clientCompanyName, clientBillingContact,
   *     clientStatus: 'active' | 'trial' | 'paused',
   *     onboardedAt, monthlyFee, commissionPercent
   *   }
   */
  clientMetadata: jsonb('client_metadata')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
