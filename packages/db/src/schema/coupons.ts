import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { locations } from './locations'
import { customers } from './customers'
// Phase 5 — journeyResponses table dropped. journey_response_id column
// below is now an orphan UUID (no FK); cross-reference via
// survey_responses.legacy_journey_response_id.
import { reviews } from './reviews'
import {
  discountTypeEnum,
  couponStatusEnum,
  deliveryMethodEnum,
  deliveryStatusEnum,
} from './enums'

/** Reusable coupon definitions */
export const couponTemplates = pgTable('coupon_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  codePrefix: varchar('code_prefix', { length: 20 }).notNull(),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: real('discount_value').notNull(),
  description: text('description'),
  termsAndConditions: text('terms_and_conditions'),
  maxRedemptions: integer('max_redemptions'),
  validityDays: integer('validity_days').default(30).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/** Individual issued coupons */
export const couponInstances = pgTable(
  'coupon_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => couponTemplates.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    journeyResponseId: uuid('journey_response_id'),
    reviewId: uuid('review_id').references(() => reviews.id, {
      onDelete: 'set null',
    }),
    uniqueCode: varchar('unique_code', { length: 50 }).notNull(),
    status: couponStatusEnum('status').default('issued').notNull(),
    issuedAt: timestamp('issued_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    redeemedAt: timestamp('redeemed_at'),
    deliveryMethod: deliveryMethodEnum('delivery_method').notNull(),
    deliveryStatus: deliveryStatusEnum('delivery_status')
      .default('pending')
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('coupon_instances_unique_code').on(table.uniqueCode),
  ]
)
