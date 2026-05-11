import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { surveys } from './surveys'
import { users } from './users'

/**
 * QR Code Management System.
 *
 * Persistent registry for every QR code generated within a workspace. Each
 * row pairs a short tracking code with a survey destination (journey or
 * truform), and records click count for analytics. The owner-facing
 * dashboard at /dashboard/qr lists these.
 *
 * Scan flow:
 *   1. Customer scans the QR → hits {APP_URL}/q/{shortCode}
 *   2. Next.js route handler calls trpc.qr.recordClickAndResolve
 *   3. API atomically increments clickCount and returns destinationUrl
 *   4. Browser is 302-redirected to destinationUrl (the j/ or f/ page)
 */

export const qrTargetTypeEnum = pgEnum('qr_target_type', ['journey', 'form'])
export const qrStatusEnum = pgEnum('qr_status', ['active', 'archived'])

export const qrCodes = pgTable(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /**
     * Optional — if set, scans get the location attached as a query
     * param on the destination URL for per-location attribution.
     */
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),

    targetType: qrTargetTypeEnum('target_type').notNull(),
    /**
     * The `surveys.id` (journey or truform). Kept loose (not FK) because
     * surveys can be archived independently and we still want the QR row
     * for historical click data.
     */
    targetId: uuid('target_id').notNull(),

    /**
     * Owner-set description of what this QR is for, e.g. "Counter
     * sticker", "Receipt footer", "Diwali campaign". Shown in the
     * dashboard table. Optional but strongly recommended.
     */
    label: varchar('label', { length: 255 }),

    /**
     * Short base64url tracking code (8 chars). Unique per row. Used as
     * the slug at /q/{shortCode}. Collision space is ~2.8 * 10^14, far
     * more than enough for any single workspace.
     */
    shortCode: varchar('short_code', { length: 32 }).notNull().unique(),

    /**
     * Cached destination URL — the journey/form public page URL the QR
     * resolves to. Recomputed on creation; not auto-refreshed if the
     * survey slug ever changes (slugs are treated as immutable URL
     * contracts in this codebase).
     */
    destinationUrl: text('destination_url').notNull(),

    /**
     * Denormalized click counter for fast reads on the dashboard table.
     * Each scan atomically increments via SQL `count + 1`.
     */
    clickCount: integer('click_count').notNull().default(0),

    /**
     * Future-proofing for per-QR styling without a schema migration —
     * brand color override, logo overlay, etc. Empty `{}` by default.
     */
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    status: qrStatusEnum('status').notNull().default('active'),

    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_qr_codes_workspace').on(t.workspaceId),
    index('idx_qr_codes_target').on(t.targetType, t.targetId),
    index('idx_qr_codes_short_code').on(t.shortCode),
  ],
)

export type QrCode = typeof qrCodes.$inferSelect
export type NewQrCode = typeof qrCodes.$inferInsert
