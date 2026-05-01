import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { organizationTypeEnum } from './enums'

/**
 * Phase 1 — Organizations layer.
 *
 * An organization is the top-level tenant. Workspaces (the previous root)
 * become children. The `type` field decides what UX gets rendered:
 *   - 'direct'         → 1 workspace, org layer hidden in UI
 *   - 'multi_location' → N workspaces (one per branch), chain rollup UX
 *   - 'agency'         → N workspaces (one per client), portfolio UX,
 *                        white-label rendering applied to all child workspaces
 *
 * Backfill: every existing workspace gets one direct organization in
 * Stage A migration 0008. The workspace's owner becomes an `org_owner`.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  /**
   * Globally unique slug. Used for vanity URLs, white-label custom-domain
   * lookup, and as a debugging breadcrumb in logs. Backfill format:
   * `{workspace.slug}-org`, truncated to 100 chars.
   */
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  type: organizationTypeEnum('type').default('direct').notNull(),
  /**
   * The owner is a user who has full control of the org and all workspaces
   * within it. There can be more than one org_owner (see organization_members
   * for additional owners), but the `ownerUserId` here is the originator —
   * the user whose account created the org.
   */
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id),
  /**
   * Free-form org-level settings. Examples:
   *   { timezone, defaultLanguage, billingEmail }
   *   // agency-only:
   *   { commissionPercent, defaultClientPlan }
   */
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
  /**
   * White-label config (agency-only feature, but stored on every org for
   * type symmetry). Phase 1 Stage F populates the consumer code paths.
   */
  whiteLabel: jsonb('white_label')
    .$type<{
      enabled?: boolean
      logoUrl?: string
      faviconUrl?: string
      primaryColor?: string
      secondaryColor?: string
      footerText?: string
      supportEmail?: string
      supportPhone?: string
      customDomain?: string
    }>()
    .default({})
    .notNull(),
  /**
   * Lifecycle status. 'active' is the default; 'suspended' / 'archived' for
   * billing or admin actions later. Not a hard enum yet so we can iterate.
   */
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
