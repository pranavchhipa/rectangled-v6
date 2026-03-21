# Sprint 3: Analytics, Customers & Background Sync — Design Doc

**Date**: 2026-03-08
**Sprint**: 3 of 8 (Analytics-Heavy scope)
**Status**: COMPLETE

---

## Scope

Sprint 3 adds four capabilities to OptimizerV6:

1. **Background Review Sync** — Automated 6-hour cron sync for all active GBP connectors
2. **Bulk AI Response Generation** — Generate AI responses for up to 50 reviews at once
3. **Customer Management Module** — Full CRUD for customer/contact records linked to reviews
4. **Review Analytics Dashboard** — 8-chart analytics page with health score

---

## Schema Changes

### `connector_instances` table
- Added `lastSyncAt: timestamp('last_sync_at')` — tracks when each connector was last synced

### `reviews` table
- Added `customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' })` — links reviews to customer records

### Relations
- `customersRelations` — workspace (many-to-one), reviews (one-to-many)
- `reviewsRelations` — added `customer` (many-to-one via customerId)
- `workspacesRelations` — added `customers` (one-to-many)

---

## Feature 1: Background Review Sync

### Architecture
- Uses `@nestjs/schedule` with `@Cron('0 */6 * * *')` decorator
- `ReviewSyncService` (new) queries all active GBP connector instances and calls `syncReviewsInternal()` for each
- `performSync()` extracted as private method in `ReviewService` — shared by manual sync, cron sync, and sync-all

### New Endpoints
- `review.syncAll` — manually trigger sync for all GBP connectors in a workspace (requires `manage_connectors` permission)

### Key Files
- `apps/api/src/review/review-sync.service.ts` — Cron service
- `apps/api/src/review/review.service.ts` — `syncReviewsInternal()`, `syncAll()`, `performSync()`
- `apps/api/src/app.module.ts` — `ScheduleModule.forRoot()`

---

## Feature 2: Bulk AI Response Generation

### Design
- `review.bulkGenerateResponses` endpoint accepts array of review IDs (1-50)
- Processes sequentially to avoid OpenRouter rate limits
- Returns per-review result: `{ reviewId, success, error? }`
- Reuses existing `AIResponseService.generateResponse()` under the hood

### Validator
```typescript
bulkGenerateResponsesSchema = z.object({
  reviewIds: z.array(uuidSchema).min(1).max(50),
})
```

### Frontend
- Bulk action bar appears when reviews are selected via checkbox
- Shows selected count + "Generate AI Responses" button
- Progress feedback during generation

---

## Feature 3: Customer Management

### Backend
- Full CRUD service: `list`, `getById`, `create`, `update`, `delete`, `getReviews`
- Search across name, email, phone fields
- Tag filtering via PostgreSQL `@>` array containment
- Customer-review linking: matches by `customerId` FK or reviewer name fallback

### Validators
- `listCustomersSchema` — search, tags[], page, limit
- `createCustomerSchema` — name (required), email, phone, tags[]
- `updateCustomerSchema` — all fields optional
- `getCustomerReviewsSchema` — customerId, page, limit

### Frontend
- `/dashboard/customers` — card grid with search bar
- `CustomerCard` — shows name, email, phone, tags, review count
- `CustomerFormSheet` — create/edit form (Sheet, not Dialog)
- `CustomerDetailSheet` — full details + linked reviews list

---

## Feature 4: Review Analytics Dashboard

### Backend: `review.analytics` endpoint
Runs 8 parallel SQL queries:

| Query | Description |
|-------|-------------|
| `ratingDistribution` | Count of reviews per rating (1-5) |
| `sentimentBreakdown` | Count per sentiment (positive/neutral/negative) |
| `reviewVelocity` | Reviews per day over date range |
| `responseRate` | Total reviews vs responded reviews |
| `avgRating` | Average star rating |
| `topThemes` | Top 10 AI-extracted themes by count |
| `platformBreakdown` | Reviews per platform (GBP/Zomato/etc) |
| `ratingTrend` | Average rating per day over date range |

### Health Score Formula
```
healthScore = ratingScore * 30 + responseRate * 25 + sentimentRatio * 25 + volumeScore * 20
```
Where:
- `ratingScore = (avgRating - 1) / 4` (normalized 0-1)
- `volumeScore = min(log10(total + 1) / 2, 1)` (logarithmic scale)
- `sentimentRatio = positive / (positive + negative)` (0-1)

### Frontend Components (all use Recharts)
| Component | Chart Type | Description |
|-----------|-----------|-------------|
| `HealthScoreCard` | SVG gauge | Circular progress with score 0-100 |
| `RatingDistributionChart` | BarChart | Horizontal bars for 1-5 stars |
| `ReviewVelocityChart` | AreaChart | Review volume over time |
| `SentimentChart` | PieChart (donut) | Positive/neutral/negative split |
| `PlatformComparisonChart` | BarChart | Grouped bars per platform |
| `RatingTrendChart` | LineChart | Average rating over time |
| `ResponseRateCard` | Progress bar | Percentage with shadcn Progress |
| `TopThemesChart` | BarChart (horizontal) | Top 10 themes by frequency |

### Date Range Filter
- Presets: 7d, 30d (default), 90d, custom
- Optional location filter
- Validator: `reviewAnalyticsSchema`

---

## Build Output

All 4 packages build cleanly:
- `@rectangled/shared` — validators for customer + analytics
- `@rectangled/db` — schema changes (lastSyncAt, customerId, relations)
- `@rectangled/api` — NestJS with schedule module, customer module, updated review module
- `@rectangled/web` — 15 static pages, analytics (136kB), customers (10.4kB)

---

## Sidebar Navigation (updated)
1. Home
2. Locations
3. Connectors
4. Reviews
5. **Analytics** (new — BarChart3 icon)
6. **Customers** (new — Contact icon)
7. Members
8. Settings
