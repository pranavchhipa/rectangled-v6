import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }).default('India').notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  ownerName: varchar('owner_name', { length: 255 }),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Kolkata').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
  // Hotfix PRD §4 — per-location branding for public QR pages. All
  // optional; renderer falls back to workspace.logo_url / brand_colors
  // / name when these are unset (see resolvePublicBranding helper in
  // apps/api/src/surveys/branding.helper.ts).
  logoUrl: text('logo_url'),
  brandColor: varchar('brand_color', { length: 7 }),
  displayName: varchar('display_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
