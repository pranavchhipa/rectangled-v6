# Sprint 2: Connectors Hub + Review Management — Implementation Plan

> **Goal:** Build the data pipeline — connect external review platforms (starting with GBP), ingest reviews, display them, and generate AI-powered responses.

**Architecture:** API-First — each feature built end-to-end (backend tRPC procedures -> frontend UI).

**Design Doc:** `docs/plans/2026-03-08-sprint2-connectors-reviews-design.md`

---

## Task 1: Reviews & Response DB Schema

**Files:**
- Create: `packages/db/src/schema/reviews.ts`
- Modify: `packages/db/src/schema/index.ts` (export new tables)
- Modify: `packages/db/src/schema/relations.ts` (add connector + review relations)

**Step 1: Create `reviews` table**

```ts
// packages/db/src/schema/reviews.ts
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  connectorInstanceId: uuid('connector_instance_id').references(() => connectorInstances.id, { onDelete: 'set null' }),
  platform: varchar('platform', { length: 50 }).notNull(), // 'google', 'zomato'
  platformReviewId: varchar('platform_review_id', { length: 255 }).notNull(),
  reviewerName: varchar('reviewer_name', { length: 255 }),
  reviewerAvatarUrl: text('reviewer_avatar_url'),
  rating: integer('rating').notNull(), // 1-5
  text: text('text'),
  reviewedAt: timestamp('reviewed_at').notNull(),
  language: varchar('language', { length: 10 }).default('en'),
  sentiment: varchar('sentiment', { length: 20 }), // positive, negative, neutral, mixed
  sentimentScore: real('sentiment_score'), // -1.0 to 1.0
  themes: text('themes').array(), // AI-extracted
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('reviews_platform_unique').on(table.workspaceId, table.platform, table.platformReviewId),
])
```

**Step 2: Create `review_responses` table**

```ts
export const reviewResponses = pgTable('review_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, approved, posted, rejected
  generatedBy: varchar('generated_by', { length: 20 }).default('ai').notNull(), // ai, human
  aiModel: varchar('ai_model', { length: 100 }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  postedAt: timestamp('posted_at'),
  platformResponseId: varchar('platform_response_id', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

**Step 3: Add relations for connectors + reviews**

Update `relations.ts` with:
- `connectorTypes` → `connectorInstances` (1:N)
- `connectorInstances` → `connectorType`, `workspace`, `location` (N:1)
- `reviews` → `workspace`, `location`, `connectorInstance` (N:1)
- `reviews` → `reviewResponses` (1:N)
- `reviewResponses` → `review`, `approvedByUser` (N:1)

**Step 4: Export from index.ts and run `db:push`**

---

## Task 2: Shared Validators — Connector + Review

**Files:**
- Create: `packages/shared/src/validators/connector.ts`
- Create: `packages/shared/src/validators/review.ts`
- Modify: `packages/shared/src/validators/index.ts` (export new validators)

**Connector validators:**
- `listConnectorTypesSchema` — empty (no input needed)
- `listConnectorInstancesSchema` — `{ workspaceId: uuid, locationId?: uuid }`
- `connectConnectorSchema` — `{ connectorTypeId: string, workspaceId: uuid, locationId?: uuid, credentials?: object, config?: object }`
- `disconnectConnectorSchema` — `{ instanceId: uuid }`
- `updateConnectorConfigSchema` — `{ instanceId: uuid, config: object }`
- `gbpAuthUrlSchema` — `{ workspaceId: uuid, locationId: uuid, redirectUrl: string }`
- `gbpCallbackSchema` — `{ code: string, workspaceId: uuid, locationId: uuid, redirectUrl: string }`

**Review validators:**
- `listReviewsSchema` — `{ workspaceId, locationId?, platform?, minRating?, maxRating?, sentiment?, search?, dateFrom?, dateTo?, page?, limit? }`
- `getReviewSchema` — `{ reviewId: uuid }`
- `syncReviewsSchema` — `{ connectorInstanceId: uuid }`
- `reviewStatsSchema` — `{ workspaceId: uuid }`
- `generateResponseSchema` — `{ reviewId: uuid }`
- `approveResponseSchema` — `{ responseId: uuid }`
- `rejectResponseSchema` — `{ responseId: uuid }`
- `editResponseSchema` — `{ responseId: uuid, content: string.min(1).max(2000) }`
- `postResponseSchema` — `{ responseId: uuid }`

**Build shared package after changes.**

---

## Task 3: Connector Backend — Service + Router + Module

**Files:**
- Create: `apps/api/src/connector/connector.module.ts`
- Create: `apps/api/src/connector/connector.service.ts`
- Create: `apps/api/src/connector/connector.router.ts`
- Modify: `apps/api/src/trpc/trpc.router.ts` (add connector sub-router)
- Modify: `apps/api/src/trpc/trpc.module.ts` (import ConnectorModule)

**ConnectorService methods:**
- `seedTypes()` — Upsert 4 connector types (gbp, zomato, wapisnap, email) into connector_types. Called from `onModuleInit`.
- `listTypes()` — Return all active connector types.
- `listInstances(workspaceId, locationId?, userId)` — Membership check + query connector_instances joined with connector_types.
- `connect(input, userId)` — Check `connector:connect` permission, create connector_instance with status=pending.
- `disconnect(instanceId, userId)` — Check `connector:disconnect` permission, delete instance.
- `updateConfig(instanceId, config, userId)` — Check `connector:configure` permission, update config JSONB.
- `updateStatus(instanceId, status, errorMessage?)` — Internal method for adapters.
- `getInstanceById(instanceId, userId)` — Single instance, membership check.

**ConnectorRouter procedures:**
- `connector.listTypes` → query, protected
- `connector.listInstances` → query, protected
- `connector.connect` → mutation, protected
- `connector.disconnect` → mutation, protected
- `connector.updateConfig` → mutation, protected
- `connector.getGbpAuthUrl` → query, protected (delegates to GBP adapter)
- `connector.handleGbpCallback` → mutation, protected (delegates to GBP adapter)

**Wire into tRPC:**
- Static: `connector: createConnectorRouter(null as any)`
- Runtime: `connector: createConnectorRouter(this.connectorService)`
- Module imports ConnectorModule, TrpcRouter injects ConnectorService

---

## Task 4: GBP Adapter — OAuth + Review Fetch

**Files:**
- Create: `apps/api/src/connector/adapters/gbp.adapter.ts`

**Install dependency:**
```bash
cd apps/api && npm install googleapis
```

**GBP Adapter class (injectable NestJS service):**

```ts
@Injectable()
export class GbpAdapter {
  constructor(private config: ConfigService) {}

  getAuthUrl(redirectUrl: string, state: string): string
  // Scopes: business.manage
  // State encodes: workspaceId + locationId

  async exchangeCode(code: string, redirectUrl: string): Promise<{ accessToken, refreshToken, expiresAt }>

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken, expiresAt }>

  async listAccounts(accessToken: string): Promise<GbpAccount[]>

  async listLocations(accessToken: string, accountName: string): Promise<GbpLocation[]>

  async fetchReviews(accessToken: string, locationName: string, pageToken?: string): Promise<{ reviews: GbpReview[], nextPageToken? }>

  async replyToReview(accessToken: string, reviewName: string, comment: string): Promise<void>
}
```

**Integration with ConnectorService:**
- `connector.getGbpAuthUrl` calls `gbpAdapter.getAuthUrl()`
- `connector.handleGbpCallback` calls `gbpAdapter.exchangeCode()`, stores tokens in connector_instance.credentials, sets status=connected
- Review sync (Task 5) calls `gbpAdapter.fetchReviews()`

**Environment variables:**
- `GBP_CLIENT_ID` (can reuse GOOGLE_CLIENT_ID)
- `GBP_CLIENT_SECRET`
- `GBP_REDIRECT_URI`

---

## Task 5: Review Backend — Service + Router + Module

**Files:**
- Create: `apps/api/src/review/review.module.ts`
- Create: `apps/api/src/review/review.service.ts`
- Create: `apps/api/src/review/review.router.ts`
- Modify: `apps/api/src/trpc/trpc.router.ts` (add review sub-router)
- Modify: `apps/api/src/trpc/trpc.module.ts` (import ReviewModule)

**ReviewService methods:**

- `syncReviews(connectorInstanceId, userId)`:
  1. Get connector_instance + verify membership
  2. Get GBP adapter, refresh token if needed
  3. Fetch all reviews from GBP (paginated)
  4. Upsert reviews (ON CONFLICT on platform_review_id)
  5. Return { synced: count }

- `list(workspaceId, filters, userId)`:
  1. Membership check
  2. Build query with optional filters (platform, rating range, sentiment, date range, text search)
  3. Paginated results with total count
  4. Include latest response status for each review

- `getById(reviewId, userId)` — Single review with all responses

- `getStats(workspaceId, userId)`:
  - totalReviews, avgRating, reviewsThisWeek
  - responseRate (reviews with at least one posted response)
  - platformBreakdown { google: N, zomato: N }
  - ratingDistribution [count per 1-5]

**ReviewRouter procedures:**
- `review.sync` → mutation, protected, connector:connect
- `review.list` → query, protected, review:view
- `review.getById` → query, protected, review:view
- `review.stats` → query, protected, review:view
- `review.generateResponse` → mutation, protected, review:respond
- `review.approveResponse` → mutation, protected, review:approve_response
- `review.rejectResponse` → mutation, protected, review:approve_response
- `review.editResponse` → mutation, protected, review:respond
- `review.postResponse` → mutation, protected, review:approve_response

---

## Task 6: AI Review Response Engine

**Files:**
- Create: `apps/api/src/review/ai-response.service.ts`
- Modify: `apps/api/src/review/review.service.ts` (inject AI service)
- Modify: `.env.example` (add OPENROUTER keys)

**AIResponseService:**

```ts
@Injectable()
export class AIResponseService {
  constructor(private config: ConfigService) {}

  async generateResponse(review: Review, workspace: Workspace): Promise<string> {
    // 1. Build system prompt with workspace tone, industry, location
    // 2. Build user prompt with review details
    // 3. Call OpenRouter API (fetch-based, no SDK needed)
    // 4. Return generated text
  }
}
```

**System prompt template:**
```
You are a business owner responding to a customer review.
Business: {workspace.name} ({workspace.industry})
Location: {location.name}, {location.city}
Tone: {workspace.tonePreset} — {tone description}
Rules:
- 2-4 sentences, natural and human-like
- Address the reviewer by name if available
- Acknowledge specific points from the review
- For negative reviews: be empathetic, offer resolution
- For positive reviews: express genuine gratitude
- Never sound robotic or template-like
- Match the language of the review
```

**OpenRouter API call:**
```ts
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: this.config.get('OPENROUTER_DEFAULT_MODEL') || 'anthropic/claude-3.5-sonnet',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    max_tokens: 300,
    temperature: 0.7,
  }),
})
```

**Integration with ReviewService:**
- `generateResponse(reviewId, userId)`:
  1. Fetch review + workspace + location
  2. Call `aiResponseService.generateResponse(review, workspace)`
  3. Create `review_responses` row with status='draft', generatedBy='ai'
  4. Store model name + token usage in metadata

---

## Task 7: Connector Frontend — Marketplace Page

**Files:**
- Create: `apps/web/src/app/dashboard/connectors/page.tsx`
- Create: `apps/web/src/components/connector/connector-card.tsx`
- Create: `apps/web/src/components/connector/connector-connect-sheet.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar.tsx` (add Connectors + Reviews nav)

**Connectors page layout:**
- Header: "Connectors" + "Manage your platform integrations" subtitle
- Grid of connector type cards (2-3 columns)
- Each card: icon placeholder, name, description, binding level tag, status badge
- Connected instances listed below the card (for location-bound connectors)

**ConnectorCard component:**
- Shows connector type info
- If no instances: "Connect" button
- If has instances: list with location name + status badge + "Disconnect" dropdown
- GBP card: "Connect" triggers OAuth flow
- Other cards: "Coming soon" badge

**ConnectorConnectSheet (for GBP):**
- Sheet slide-in
- Step 1: Select location to connect
- Step 2: Click "Authorize with Google" → redirects to Google OAuth
- Loading states

**Sidebar update:**
- Add between Team and Settings:
  - `{ label: 'Reviews', href: '/dashboard/reviews', icon: MessageSquare }`
  - `{ label: 'Connectors', href: '/dashboard/connectors', icon: Plug }`

---

## Task 8: GBP OAuth Callback Page

**Files:**
- Create: `apps/web/src/app/dashboard/connectors/callback/page.tsx`

**Flow:**
1. Google redirects to `/dashboard/connectors/callback?code=xxx&state=yyy`
2. Parse `code` and `state` (state contains workspaceId + locationId)
3. Call `connector.handleGbpCallback` tRPC mutation
4. On success: redirect to `/dashboard/connectors` with toast "Google Business Profile connected!"
5. On error: redirect to `/dashboard/connectors` with error toast
6. Show loading spinner during processing

---

## Task 9: Reviews Frontend — List Page

**Files:**
- Create: `apps/web/src/app/dashboard/reviews/page.tsx`
- Create: `apps/web/src/components/review/review-card.tsx`
- Create: `apps/web/src/components/review/review-filters.tsx`
- Create: `apps/web/src/components/review/review-stats-bar.tsx`

**Reviews page layout:**

1. **Stats bar** (top): 4 metric cards in a row
   - Total Reviews (number)
   - Average Rating (stars display)
   - Response Rate (percentage)
   - This Week (number with trend)

2. **Filter bar**: Platform select, Rating filter (star buttons), Sentiment dropdown, Date range, Search input
   - Filters update URL params for shareable state

3. **Review list**: Vertical card list (not table — cards are more readable for review text)
   - Each card: star rating (colored), reviewer name, platform badge, relative date
   - Review text (truncated to 2 lines, expandable)
   - Response status badge: "No response" (gray), "Draft" (amber), "Approved" (blue), "Posted" (green)
   - Click card → opens detail sheet

4. **Pagination**: Page numbers at bottom

5. **Empty state**: "No reviews yet" with CTA to connect a platform

---

## Task 10: Review Detail Sheet + AI Response UI

**Files:**
- Create: `apps/web/src/components/review/review-detail-sheet.tsx`
- Create: `apps/web/src/components/review/ai-response-section.tsx`

**Review Detail Sheet (shadcn Sheet, right slide-in):**

**Header section:**
- Star rating (large, colored)
- Reviewer name + avatar
- Platform badge + review date
- Full review text

**Response section (`AIResponseSection`):**

State machine:
- **No response**: Purple "Generate AI Response" button
- **Generating**: Loading skeleton with "AI is writing a response..." text
- **Draft**: Response text in bordered card + action buttons:
  - "Approve" (green) — marks as approved
  - "Edit" (outline) — opens inline editor
  - "Reject" (red outline) — discards draft
  - "Regenerate" (outline) — generates new response
- **Approved**: Response text + "Post to Google" button
- **Posted**: Response text with "Posted on {date}" green badge

**Inline editor:**
- Textarea pre-filled with AI response
- Character count (max 2000)
- "Save" and "Cancel" buttons

---

## Task 11: Sync Reviews Button + Flow

**Files:**
- Modify: `apps/web/src/app/dashboard/reviews/page.tsx` (add sync button)
- Modify: `apps/web/src/app/dashboard/connectors/page.tsx` (add sync action)

**Sync flow:**
- "Sync Reviews" button in reviews page header (RefreshCw icon)
- Calls `review.sync` for each connected GBP instance
- Shows loading state with progress
- Toast on completion: "Synced {N} new reviews"
- Auto-refresh review list after sync

**Also on connector card:**
- "Sync Now" dropdown action on connected GBP instances
- Last synced timestamp display

---

## Task 12: Dashboard Home Updates

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

**Changes:**
- Add "Reviews" stat card (MessageSquare icon, brand color) showing total review count
- Update "Connectors" stat card to show actual connected count (not hardcoded 0)
- Use `review.stats` query for review count
- Use `connector.listInstances` query for connector count
- Update onboarding checklist:
  - "Connect a review platform" → links to `/dashboard/connectors` (remove "Coming soon")
  - Mark as done if connectorCount > 0
  - Add new item: "Sync your first reviews" → links to `/dashboard/reviews`
  - Mark as done if reviewCount > 0

---

## Task 13: Update .env.example + Env Config

**Files:**
- Modify: `.env.example`
- Modify: `apps/api/src/app.module.ts` (if config validation needed)

**Add to `.env.example`:**
```
# Google Business Profile (Connector)
GBP_CLIENT_ID=
GBP_CLIENT_SECRET=
GBP_REDIRECT_URI=http://localhost:3000/dashboard/connectors/callback

# AI — OpenRouter (for review responses)
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

---

## Task 14: Integration Polish + Error Handling

**Focus areas:**
- Toast notifications for all connector/review operations (connect, disconnect, sync, generate, approve, post)
- Error states: connector auth failure, review sync failure, AI generation failure
- Loading skeletons for reviews list, connector cards, stats bar
- Proper RBAC enforcement: staff can view reviews but not respond; viewer can only view
- Redirects: unauthenticated users to /login, unauthorized actions show permission error toast
- Review text search debounced (300ms) to avoid excessive API calls
- Mobile responsive: connector cards stack to 1 column, reviews fill width

---

## Task 15: Full Flow Smoke Test

**Manual verification checklist:**
1. Navigate to /dashboard/connectors — see 4 connector type cards (GBP, Zomato, Wapisnap, Email)
2. GBP card has "Connect" button, others show "Coming soon"
3. Click "Connect" on GBP → select location → redirects to Google OAuth
4. After OAuth → redirected back → GBP shows "Connected" status
5. Navigate to /dashboard/reviews → see empty state with "Connect a platform" CTA
6. Click "Sync Reviews" → reviews fetched from GBP → list populated
7. Click a review → detail sheet opens with full text
8. Click "Generate AI Response" → loading → AI response appears as draft
9. Click "Approve" → status changes to "Approved"
10. Click "Post to Google" → response posted to GBP → status changes to "Posted"
11. Dashboard home shows updated review count + connector count
12. Onboarding checklist shows "Connect a review platform" ✓ and "Sync your first reviews" ✓

---

## Build Order (Dependency Graph)

```
Task 1 (DB Schema) ──────┐
Task 2 (Validators) ─────┤
                          ├─→ Task 3 (Connector Service) ──→ Task 4 (GBP Adapter) ──→ Task 7 (Connector UI) ──→ Task 8 (Callback)
                          │
                          ├─→ Task 5 (Review Service) ──→ Task 6 (AI Engine) ──→ Task 9 (Reviews UI) ──→ Task 10 (Detail Sheet)
                          │
                          └─→ Task 11 (Sync Flow) ──→ Task 12 (Dashboard Updates) ──→ Task 13 (Env) ──→ Task 14 (Polish) ──→ Task 15 (Smoke Test)
```

Tasks 1-2 can run in parallel. Tasks 3-4 and 5-6 can run in parallel. Frontend tasks (7-10) depend on their respective backend tasks.
