# Sprint 2: Connectors Hub + Review Management — Design Document

**Date:** 2026-03-08
**Status:** Proposed
**Prerequisite:** Sprint 1 (Core Foundation) — Complete
**Approach:** API-First (backend tRPC -> frontend UI per feature)

## Scope

Sprint 2 builds the data pipeline — connecting external review platforms and managing reviews:
1. Connectors Hub backend (service + tRPC router + seed data)
2. Reviews DB schema (reviews + review_responses tables)
3. GBP connector adapter (Google OAuth + review fetch)
4. Connectors Hub frontend (marketplace grid + connect/disconnect flow)
5. Reviews dashboard frontend (list + filters + detail view)
6. AI Review Response engine (OpenRouter-powered generation + approval workflow)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sprint scope | Connectors + Reviews + AI Responses | Reviews are the core data everything else depends on |
| GBP auth | Google OAuth 2.0 (official API) | Already have Google OAuth infra from auth; extend for GBP scopes |
| Zomato | Deferred to Sprint 3 | Scraping is fragile; focus on GBP first with official API |
| AI provider | OpenRouter API (model-agnostic) | Pay-per-token, switch models freely, blueprint requirement |
| Review response workflow | Draft + Approve + Post | Human-in-the-loop before posting to GBP |
| Credential storage | JSONB encrypted at app-level | Simple for MVP; upgrade to vault later |
| Review sync | On-demand + periodic (manual trigger + cron placeholder) | Start simple, add background jobs in Sprint 3 |
| Connector UI | Marketplace card grid | Blueprint 4.3 spec, status badges, per-location binding |

---

## 1. Connector Backend

### 1.1 Connector Validators (`packages/shared/src/validators/connector.ts`)

```
connectConnectorSchema: { connectorTypeId, workspaceId, locationId?, credentials?, config? }
updateConnectorConfigSchema: { instanceId, config }
disconnectConnectorSchema: { instanceId }
listConnectorsSchema: { workspaceId, locationId? }
```

### 1.2 Connector Service (`apps/api/src/connector/connector.service.ts`)

**Methods:**
- `seedConnectorTypes()` — Upsert GBP, Zomato, Wapisnap, Email into connector_types table
- `listTypes()` — Return all active connector types
- `listInstances(workspaceId, locationId?)` — Return user's connected instances with type info
- `connect(input, userId)` — Create connector_instance, validate permissions, set status=pending
- `disconnect(instanceId, userId)` — Delete connector_instance, check permissions
- `updateConfig(instanceId, config, userId)` — Update config JSONB
- `updateStatus(instanceId, status, errorMessage?)` — Internal status update
- `getInstanceById(instanceId, userId)` — Single instance with permission check

**Seed data for `connector_types`:**

| id | name | authType | bindingLevel |
|----|------|----------|-------------|
| `gbp` | Google Business Profile | oauth2 | location |
| `zomato` | Zomato | profile_url | location |
| `wapisnap` | Wapisnap | api_key | workspace |
| `email` | Email Provider | api_key | workspace |

### 1.3 Connector Router (`apps/api/src/connector/connector.router.ts`)

| Procedure | Type | Auth | Input | Output |
|-----------|------|------|-------|--------|
| `connector.listTypes` | query | protected | — | `ConnectorType[]` |
| `connector.listInstances` | query | protected | `{workspaceId, locationId?}` | `ConnectorInstance[]` (with type joined) |
| `connector.connect` | mutation | protected | `{connectorTypeId, workspaceId, locationId?, credentials?, config?}` | `ConnectorInstance` |
| `connector.disconnect` | mutation | protected | `{instanceId}` | `{success}` |
| `connector.updateConfig` | mutation | protected | `{instanceId, config}` | `ConnectorInstance` |
| `connector.getGbpAuthUrl` | query | protected | `{workspaceId, locationId, redirectUrl}` | `{url}` |
| `connector.handleGbpCallback` | mutation | protected | `{code, workspaceId, locationId, redirectUrl}` | `ConnectorInstance` |

### 1.4 GBP Adapter (`apps/api/src/connector/adapters/gbp.adapter.ts`)

**Responsibilities:**
- Generate Google OAuth URL with GBP-specific scopes (`business.manage`)
- Exchange authorization code for access/refresh tokens
- Fetch Google Business accounts & locations for the user
- Fetch reviews for a specific GBP location
- Post AI-generated review responses to GBP

**Google API scopes needed:**
- `https://www.googleapis.com/auth/business.manage` — Read/write reviews

**Key methods:**
- `getAuthUrl(redirectUrl, state)` — OAuth consent URL
- `exchangeCode(code, redirectUrl)` — Get tokens
- `listAccounts(accessToken)` — List GBP accounts
- `listLocations(accessToken, accountId)` — List locations under account
- `fetchReviews(accessToken, locationName, pageToken?)` — Paginated review fetch
- `replyToReview(accessToken, reviewName, comment)` — Post response

---

## 2. Reviews Schema

### 2.1 New DB Tables (`packages/db/src/schema/reviews.ts`)

**`reviews` table:**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| workspaceId | uuid FK→workspaces | CASCADE delete |
| locationId | uuid FK→locations | CASCADE delete |
| connectorInstanceId | uuid FK→connector_instances | Which connector pulled this |
| platform | varchar(50) | 'google', 'zomato', etc. |
| platformReviewId | varchar(255) | External ID for dedup |
| reviewerName | varchar(255) | |
| reviewerAvatarUrl | text | |
| rating | integer | 1-5 stars |
| text | text | Review body |
| reviewedAt | timestamp | When customer wrote it |
| language | varchar(10) | 'en', 'hi', etc. |
| sentiment | varchar(20) | 'positive', 'negative', 'neutral', 'mixed' |
| sentimentScore | real | -1.0 to 1.0 |
| themes | text[] | AI-extracted themes |
| metadata | jsonb | Platform-specific data |
| createdAt | timestamp | When we ingested it |
| updatedAt | timestamp | |

**Unique constraint:** `(workspaceId, platform, platformReviewId)`

**`review_responses` table:**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| reviewId | uuid FK→reviews | CASCADE delete |
| content | text | AI-generated response text |
| status | varchar(20) | 'draft', 'approved', 'posted', 'rejected' |
| generatedBy | varchar(20) | 'ai', 'human' |
| aiModel | varchar(100) | 'claude-3.5-sonnet', etc. |
| approvedBy | uuid FK→users | Who approved |
| postedAt | timestamp | When posted to platform |
| platformResponseId | varchar(255) | External response ID |
| metadata | jsonb | Token usage, cost, etc. |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### 2.2 Review Validators (`packages/shared/src/validators/review.ts`)

```
listReviewsSchema: { workspaceId, locationId?, platform?, rating?, sentiment?, dateFrom?, dateTo?, page?, limit? }
generateResponseSchema: { reviewId }
approveResponseSchema: { responseId }
rejectResponseSchema: { responseId }
editResponseSchema: { responseId, content }
postResponseSchema: { responseId }
```

---

## 3. Review Backend

### 3.1 Review Service (`apps/api/src/review/review.service.ts`)

**Methods:**
- `syncReviews(connectorInstanceId, userId)` — Fetch reviews from platform, upsert to DB, return count
- `list(workspaceId, filters, userId)` — Paginated review list with filters
- `getById(reviewId, userId)` — Single review with responses
- `getStats(workspaceId, userId)` — Total reviews, avg rating, response rate, platform breakdown
- `generateResponse(reviewId, userId)` — Call AI to generate draft response
- `approveResponse(responseId, userId)` — Mark response as approved
- `rejectResponse(responseId, userId)` — Mark response as rejected
- `editResponse(responseId, content, userId)` — Manual edit of response
- `postResponse(responseId, userId)` — Post approved response to GBP via adapter

### 3.2 Review Router (`apps/api/src/review/review.router.ts`)

| Procedure | Type | Auth | Permission | Input | Output |
|-----------|------|------|------------|-------|--------|
| `review.sync` | mutation | protected | connector:connect | `{connectorInstanceId}` | `{synced: number}` |
| `review.list` | query | protected | review:view | `{workspaceId, filters...}` | `{reviews[], total, page}` |
| `review.getById` | query | protected | review:view | `{reviewId}` | `Review & {responses[]}` |
| `review.stats` | query | protected | review:view | `{workspaceId}` | `{total, avgRating, ...}` |
| `review.generateResponse` | mutation | protected | review:respond | `{reviewId}` | `ReviewResponse` |
| `review.approveResponse` | mutation | protected | review:approve_response | `{responseId}` | `ReviewResponse` |
| `review.rejectResponse` | mutation | protected | review:approve_response | `{responseId}` | `ReviewResponse` |
| `review.editResponse` | mutation | protected | review:respond | `{responseId, content}` | `ReviewResponse` |
| `review.postResponse` | mutation | protected | review:approve_response | `{responseId}` | `ReviewResponse` |

### 3.3 AI Response Engine

**OpenRouter integration:**
- Model: configurable via env (default: `anthropic/claude-3.5-sonnet`)
- System prompt includes: workspace tone preset, business type, location name
- User prompt includes: reviewer name, rating, review text, any previous context
- Response format: plain text, 2-4 sentences, human-like tone
- Human Imitation: varied structure, no robotic patterns

**Tone presets (from workspace settings):**
- Professional: formal, brand-focused
- Friendly: warm, personal, emoji-light
- Empathetic: understanding, solution-oriented
- Witty: clever, personality-driven

---

## 4. Connector Frontend

### 4.1 Connectors Page (`/dashboard/connectors`)

**Layout:** Marketplace card grid
- Each card shows: icon, name, description, binding level, auth type
- Status badge: Connected (green), Disconnected (gray), Error (red), Pending (amber)
- "Connect" button → starts OAuth flow or shows credential form
- "Disconnect" button → confirmation dialog
- For location-bound connectors: show which locations are connected

**New sidebar nav item:** "Connectors" with Plug icon, between Settings and Team

### 4.2 GBP Connect Flow
1. User clicks "Connect" on GBP card
2. If location-bound: user selects which location to connect
3. Frontend calls `connector.getGbpAuthUrl` → gets Google OAuth URL
4. User redirects to Google consent screen (with GBP scopes)
5. Google redirects to `/dashboard/connectors/callback?code=...&state=...`
6. Callback page calls `connector.handleGbpCallback`
7. Backend exchanges code, stores tokens, creates connector_instance
8. Redirect back to connectors page with success toast

### 4.3 Connector Callback Page (`/dashboard/connectors/callback`)
- Captures `code` and `state` from URL params
- Calls tRPC mutation to complete connection
- Shows loading state then redirects with toast

---

## 5. Reviews Frontend

### 5.1 Reviews Page (`/dashboard/reviews`)

**Layout:** Table/list view with filters
- **Filter bar:** Platform dropdown, Rating (1-5 stars), Sentiment, Date range, Search text
- **Review cards:** Star rating, reviewer name, review text (truncated), platform badge, date, response status badge
- **Click → Detail sheet** (shadcn Sheet, right slide-in)
- **Stats bar at top:** Total reviews, Average rating, Response rate, Reviews this week

### 5.2 Review Detail Sheet
- Full review text
- Platform + date + rating prominently displayed
- **Response section:**
  - If no response: "Generate AI Response" button
  - If draft: Show response text + "Approve" / "Edit" / "Reject" buttons
  - If approved: "Post to Platform" button
  - If posted: Posted badge with timestamp
- AI response generation shows loading state with animated indicator

### 5.3 Sidebar Updates
- Add "Reviews" nav item with MessageSquare icon (between Locations and Connectors)
- Add "Connectors" nav item with Plug icon (after Team)

---

## 6. Dashboard Home Updates

Update the dashboard home page:
- Replace "Connectors: 0" stat with actual connected connector count
- Add "Reviews" stat card showing total review count
- Update onboarding checklist: "Connect a review platform" links to `/dashboard/connectors` (not "Coming soon")

---

## 7. Environment Variables

Add to `.env.example`:
```
# Google Business Profile (Connector)
GBP_CLIENT_ID=          # Same as GOOGLE_CLIENT_ID or separate app
GBP_CLIENT_SECRET=
GBP_REDIRECT_URI=http://localhost:3000/dashboard/connectors/callback

# AI - OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

---

## 8. New Dependencies

**API (`apps/api/package.json`):**
- `googleapis` — Google APIs client (for GBP review fetch + response posting)
- No other new deps needed (fetch is built-in for OpenRouter API calls)

**Web (`apps/web/package.json`):**
- No new deps (all UI from existing shadcn components)
