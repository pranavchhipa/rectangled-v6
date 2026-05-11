# OptimizerV6 API Reference

Complete API documentation for the rectangled.io ORM platform. Lists every tRPC procedure across all 30 modules — 247 endpoints total — plus webhooks, public route handlers, and supporting infrastructure.

- **Production base URL:** `https://rectangled-io-g43cg.ondigitalocean.app`
- **Local API base URL:** `http://localhost:3001`
- **Stack:** NestJS + tRPC over HTTP (`httpBatchLink`), Drizzle ORM, PostgreSQL 16, Redis 7
- **Auth:** JWT bearer tokens (30-day expiry by default)
- **Frontend:** Next.js 15 + React Query via tRPC

---

## Table of Contents

1. [Conventions](#conventions)
2. [Authentication](#authentication)
3. [Error Model](#error-model)
4. [Webhooks & Public Routes](#webhooks--public-routes)
5. [Modules — A to Z](#modules)
   - [ai-agent](#1-ai-agent) · [ai-response](#2-ai-response) · [appointment](#3-appointment) · [auth](#4-auth) · [automation](#5-automation)
   - [billing](#6-billing) · [business-aspect](#7-business-aspect) · [chain](#8-chain) · [cli](#9-cli) · [connector](#10-connector)
   - [coupon](#11-coupon) · [customer](#12-customer) · [cx-routing](#13-cx-routing) · [email](#14-email) · [listing](#15-listing)
   - [location](#16-location) · [member](#17-member) · [nev](#18-nev) · [notification](#19-notification) · [onboarding](#20-onboarding)
   - [organization](#21-organization) · [organization-member](#22-organization-member) · [qr](#23-qr) · [rais](#24-rais) · [report](#25-report)
   - [review](#26-review) · [survey](#27-survey) · [wapisnap](#28-wapisnap) · [workspace](#29-workspace)

---

## Conventions

### Transport
All RPC traffic flows through tRPC over HTTP. The web client uses `httpBatchLink` with no transformer, which means request bodies are plain JSON.

**Query (HTTP GET):**
```
GET /trpc/<router>.<procedure>?batch=1&input=<URL-encoded JSON>
```

Single-call payload:
```json
{ "0": { "json": { ...input fields } } }
```

**Mutation (HTTP POST):**
```
POST /trpc/<router>.<procedure>?batch=1
Content-Type: application/json

{ "0": { ...input fields } }
```

**Response shape** (success):
```json
[{ "result": { "data": { ...output } } }]
```

**Response shape** (error):
```json
[{ "error": { "json": { "message": "...", "code": -32000, "data": { "code": "BAD_REQUEST", "httpStatus": 400, "path": "..." } } } }]
```

### Procedure types
- **query** — read operation (GET). Cacheable by React Query.
- **mutation** — write operation (POST). No client-side cache.

### Procedure auth
- **public** — no auth required. Used for sign-in, public survey routes, webhook callbacks.
- **protected** — requires `Authorization: Bearer <JWT>` header. Every protected procedure additionally calls `requireMembership(userId, workspaceId)` internally to ensure the caller is a member of the workspace whose data they're touching.

### Workspace scoping
Almost every protected procedure takes a `workspaceId` field in its input. Frontend hooks include `enabled: !!currentWorkspaceId` to avoid firing before a workspace is selected (see `apps/web/src/stores/auth-store.ts` for the Zustand store).

### Input validators
Input schemas live in `packages/shared/src/validators/<module>.ts`. They are Zod schemas, re-exported via `@rectangled/shared`. The procedure name in the table below references the schema by its exported name; consult the validator file for exact field types.

### Pagination
List endpoints typically accept:
```ts
{ page?: number, limit?: number, ...filters }
```
And return:
```ts
{ data: T[], pagination: { page, limit, total, totalPages } }
```

### IDs
All entity IDs are PostgreSQL UUIDv4. Step IDs in surveys are arbitrary strings (1-64 chars).

### Timestamps
All `createdAt` / `updatedAt` columns are ISO-8601 strings in API responses (Drizzle stores PostgreSQL `TIMESTAMP`).

---

## Authentication

### Sign-up + sign-in flow
1. **Register** → `POST /trpc/auth.register?batch=1` with `{ name, email, password }`. Server creates the user + a default `organization` + a default `workspace`. Returns `{ user, accessToken, refreshToken }`.
2. **Login** → `POST /trpc/auth.login?batch=1` with `{ email, password }`. Same return shape.
3. **Google OAuth** → see `auth.googleAuthUrl` / `auth.googleCallback` below.

### Using the token
```
Authorization: Bearer <accessToken>
```
The token is signed with `JWT_SECRET` and contains `{ sub: userId, iat, exp }`. Default expiry: `JWT_EXPIRY` env var (`30d` if unset).

### Refresh
`POST /trpc/auth.refresh?batch=1` with `{ refreshToken }` returns a new pair. Refresh tokens are stored hashed in `refresh_tokens` table; rotated on every refresh.

### Rate limiting
`/auth/register` is throttled to 3 per 5 minutes per IP. `/auth/login` is throttled to 5 per minute per IP AND 10 per 5 minutes per email. Both via `apps/api/src/trpc/rate-limit.ts`.

---

## Error Model

Every error returns the tRPC error envelope with these `data.code` values:

| Code | HTTP | When |
|---|---|---|
| `BAD_REQUEST` | 400 | Invalid input, validation failure |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Not a member of the target workspace (`requireMembership` failed) |
| `NOT_FOUND` | 404 | Entity doesn't exist or isn't visible to caller |
| `CONFLICT` | 409 | Unique constraint hit (e.g., duplicate email) |
| `PRECONDITION_FAILED` | 412 | Business rule blocks the action (e.g., onboarding URL gate) |
| `BAD_GATEWAY` | 502 | External service failed (OpenRouter, Razorpay, Google Places) |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected — engine inconsistency, DB error |

---

## Webhooks & Public Routes

These are NOT tRPC procedures. They're standard HTTP endpoints served alongside tRPC.

### Public web routes (apps/web)
| Route | File | Purpose |
|---|---|---|
| `GET /j/[slug]` | `apps/web/src/app/j/[slug]/page.tsx` | Public journey survey (multi-screen branching). Wraps `SurveyEngineRenderer`. |
| `GET /f/[slug]` | `apps/web/src/app/f/[slug]/page.tsx` | Public truform survey (same engine, just deep-template route). |
| `GET /q/[shortCode]` | `apps/web/src/app/q/[shortCode]/route.ts` | QR scan handler. Calls `qr.recordClick` → 302 redirect to the survey URL. Increments click counter atomically. |
| `GET /book` | `apps/web/src/app/book/page.tsx` | Public appointment booking. |
| `GET /accept-invite` | `apps/web/src/app/accept-invite/page.tsx` | Membership invite acceptance. |
| `GET /(auth)/login` | `apps/web/src/app/(auth)/login/page.tsx` | Login form. |
| `GET /auth/google/callback` | `apps/web/src/app/auth/google/callback/page.tsx` | Google OAuth callback. |

### REST endpoints on the API
| Route | Module | Purpose |
|---|---|---|
| `GET /health` | app.controller | Liveness probe. Returns `{ status: 'ok', version }`. |
| `POST /trpc/<router>.<procedure>?batch=1` | trpc | tRPC mutation transport. |
| `GET /trpc/<router>.<procedure>?batch=1&input=...` | trpc | tRPC query transport. |

### External webhooks
| Webhook | Endpoint | Verified via | Module |
|---|---|---|---|
| Razorpay payment events | `POST /billing/webhook` | HMAC against `RAZORPAY_WEBHOOK_SECRET` | [billing](#6-billing) |
| WapiSnap inbound messages | (handled at WapiSnap Bridge service, posts back via `WAPISNAP_BRIDGE_URL`) | HMAC-SHA256 with `WAPISNAP_BRIDGE_SECRET` | [wapisnap](#28-wapisnap) |
| GBP review push | (currently polled, not pushed) | — | [connector](#10-connector) |

---

## Modules

### 1. `ai-agent`
Higher-level AI orchestration. Chat agent for owners + ticket-raising helper.

- **Service:** `apps/api/src/ai-agent/ai-agent.service.ts`
- **Router:** `apps/api/src/ai-agent/ai-agent.router.ts`

| Procedure | Type | Auth | Input | Notes |
|---|---|---|---|---|
| `chat` | mutation | protected | inline | Conversational endpoint. Streams responses from [OpenRouter](#integrations). |
| `raiseTicket` | mutation | protected | inline | Escalates a chat thread to a support ticket. |

---

### 2. `ai-response`
AI-drafted replies to inbound reviews. Wraps the [OpenRouter](#integrations) provider via the `openai` SDK pointed at `OPENROUTER_BASE_URL`.

- **Service:** `apps/api/src/ai-response/ai-response.service.ts`
- **Router:** `apps/api/src/ai-response/ai-response.router.ts`
- **Validators:** `packages/shared/src/validators/ai-response.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `listScheduled` | query | protected | `listScheduledSchema` |
| `generateResponse` | mutation | protected | `generateAiResponseSchema` |
| `scheduleResponse` | mutation | protected | `scheduleResponseSchema` |
| `cancelSchedule` | mutation | protected | `cancelScheduleSchema` |
| `getSettings` | query | protected | `getAiSettingsSchema` |
| `updateSettings` | mutation | protected | `updateAiSettingsSchema` |
| `getDailyCounts` | query | protected | `getDailyCountsSchema` |
| `getAiResponseCount` | query | protected | `getAiSettingsSchema` |

**Tone presets** (`professional` / `friendly` / `empathetic` / `witty`) are workspace-level settings. The service applies a "humanization" pass after generation to vary contractions and add subtle sentence variation, then schedules the reply with a random delay between `minDelayDays` and `maxDelayDays`.

---

### 3. `appointment`
Booking flow for the public `/book` route. Customer picks a location + slot; survey auto-fires after the appointment time.

- **Service:** `apps/api/src/appointment/appointment.service.ts`
- **Router:** `apps/api/src/appointment/appointment.router.ts`
- **Validators:** `packages/shared/src/validators/appointment.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listAppointmentsSchema` |
| `book` | mutation | protected | `bookAppointmentSchema` |
| `publicBook` | mutation | **public** | `bookAppointmentSchema` |
| `cancel` | mutation | protected | `cancelAppointmentSchema` |
| `updateStatus` | mutation | protected | `updateAppointmentStatusSchema` |
| `availableSlots` | query | **public** | `listAvailableSlotsSchema` |

`publicBook` + `availableSlots` are the public surface called from `/book`. Both validate that the location is part of the public-facing workspace before returning anything.

---

### 4. `auth`
JWT-based authentication. 30-day access tokens. Refresh tokens are stored hashed and rotated.

- **Service:** `apps/api/src/auth/auth.service.ts`
- **Router:** `apps/api/src/auth/auth.router.ts`
- **Validators:** `packages/shared/src/validators/auth.ts`

| Procedure | Type | Auth | Input schema | Notes |
|---|---|---|---|---|
| `register` | mutation | **public** | `registerSchema` | Rate-limit: 3 / 5min / IP. Creates user + default org + default workspace. |
| `login` | mutation | **public** | `loginSchema` | Rate-limit: 5/min/IP + 10 / 5min / email. |
| `googleAuthUrl` | query | **public** | inline | Returns `{ url }` to start OAuth flow. Optional `redirectUrl` override. |
| `googleCallback` | mutation | **public** | `googleCallbackSchema` | Exchanges OAuth code for tokens; auto-registers if first sign-in. |
| `refresh` | mutation | **public** | `refreshTokenSchema` | Returns a new access+refresh pair. Old refresh token is revoked. |
| `forgotPassword` | mutation | **public** | inline | Always returns 200 (timing-safe). Sends reset email if user exists. |
| `resetPassword` | mutation | **public** | inline | Validates the token (1-hour TTL), sets new password. |
| `me` | query | protected | — | Returns the current user + memberships. |
| `requestEmailVerification` | mutation | protected | — | Sends a verification email if not already verified. |
| `logout` | mutation | protected | — | Revokes the current refresh token. |

---

### 5. `automation`
Post-Review Actions — rules that fire on review/survey events. Each rule has a trigger (e.g., NPS≤6) and a sequence of actions (send coupon, issue WhatsApp message, escalate).

- **Service:** `apps/api/src/automation/automation.service.ts`
- **Router:** `apps/api/src/automation/automation.router.ts`
- **Validators:** `packages/shared/src/validators/automation.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `listRules` | query | protected | `listAutomationRulesSchema` |
| `createRule` | mutation | protected | `createAutomationRuleSchema` |
| `updateRule` | mutation | protected | `updateAutomationRuleSchema` |
| `deleteRule` | mutation | protected | `deleteAutomationRuleSchema` |
| `listQueue` | query | protected | `listAutomationQueueSchema` |
| `cancelQueued` | mutation | protected | `cancelAutomationQueuedSchema` |
| `getStats` | query | protected | `getAutomationStatsSchema` |

**Execution surface:** rules schedule items into the automation queue (DB-backed). The internal-jobs worker drains the queue, respecting workspace-level rate caps (`maxMessagesPerDay`, `maxCouponsPerMonth`, `maxActionsPerWeek`) on `workspaces.settings.customerRateCap`.

---

### 6. `billing`
Subscription billing via Razorpay (test mode). Lazy-init of the Razorpay client (`getRazorpay()` factory) avoids module-load crashes when env vars are missing.

- **Service:** `apps/api/src/billing/billing.service.ts`
- **Router:** `apps/api/src/billing/billing.router.ts`
- **Validators:** `packages/shared/src/validators/billing.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `getCurrentPlan` | query | protected | `getCurrentPlanSchema` |
| `listInvoices` | query | protected | `listInvoicesSchema` |
| `createCheckoutSession` | mutation | protected | `createCheckoutSessionSchema` |
| `cancelSubscription` | mutation | protected | `cancelSubscriptionSchema` |
| `handleWebhook` | mutation | protected | `handleWebhookSchema` |

**Webhook:** Razorpay posts to `/billing/webhook`. HMAC verified against `RAZORPAY_WEBHOOK_SECRET`. Events: `payment.captured`, `subscription.activated`, `subscription.cancelled`.

---

### 7. `business-aspect`
Workspace-level tags ("service", "ambience", "value", etc.) used to categorize reviews and aspect-chips on the public unhappy-feedback step. Seeded from industry choice during [onboarding](#20-onboarding).

- **Service:** `apps/api/src/business-aspect/business-aspect.service.ts`
- **Router:** `apps/api/src/business-aspect/business-aspect.router.ts`
- **Validators:** `packages/shared/src/validators/business-aspect.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listBusinessAspectsSchema` |
| `seedDefaults` | mutation | protected | `seedBusinessAspectsSchema` |
| `create` | mutation | protected | `createBusinessAspectSchema` |
| `update` | mutation | protected | `updateBusinessAspectSchema` |
| `delete` | mutation | protected | `deleteBusinessAspectSchema` |
| `reorder` | mutation | protected | `reorderBusinessAspectsSchema` |

---

### 8. `chain`
Multi-location operator analytics. Aggregates across all locations in a workspace (or across workspaces in an organization).

- **Service:** `apps/api/src/chain/chain.service.ts`
- **Router:** `apps/api/src/chain/chain.router.ts`
- **Validators:** `packages/shared/src/validators/chain.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `getOverviewKpis` | query | protected | `chainOverviewSchema` |
| `getLocationLeaderboard` | query | protected | `chainLeaderboardSchema` |
| `getRatingTrendsByLocation` | query | protected | `chainRatingTrendsSchema` |
| `getGeoDistribution` | query | protected | `chainGeoDistributionSchema` |
| `getResponseTimeHeatmap` | query | protected | `chainResponseTimeHeatmapSchema` |
| `getEscalationLoad` | query | protected | `chainEscalationLoadSchema` |

Chain widgets render on `/dashboard` when a workspace has 2+ locations.

---

### 9. `cli` (Customer Loyalty Index)
Computed loyalty score per customer based on survey responses + emotion vectors + redemption history. Used for segmentation in [coupon](#11-coupon) and [automation](#5-automation) rules.

> ⚠️ `cli` here is **Customer Loyalty Index**, not "Command Line Interface."

- **Service:** `apps/api/src/cli/cli.service.ts`
- **Router:** `apps/api/src/cli/cli.router.ts`
- **Validators:** `packages/shared/src/validators/cli.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `submitResponse` | mutation | **public** | `submitCliResponseSchema` |
| `getAnalytics` | query | protected | `getCliAnalyticsSchema` |
| `getTrends` | query | protected | `getCliTrendsSchema` |
| `getSegments` | query | protected | `getCliSegmentsSchema` |
| `getCustomerCli` | query | protected | `getCustomerCliSchema` |

Segments: `champion` / `loyal` / `at-risk` / `lost`.

---

### 10. `connector`
Adapters for external review/listing platforms. OAuth-driven for Google Business Profile, calendar; cookie/scraping for Zomato (read-only).

- **Service:** `apps/api/src/connector/connector.service.ts`
- **Adapters:** `apps/api/src/connector/adapters/` (`gbp.adapter.ts`, `zomato.adapter.ts`, `calendar.adapter.ts`, `sendgrid.adapter.ts`)
- **Router:** `apps/api/src/connector/connector.router.ts`
- **Validators:** `packages/shared/src/validators/connector.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `listTypes` | query | protected | — |
| `listInstances` | query | protected | `listConnectorInstancesSchema` |
| `connect` | mutation | protected | `connectConnectorSchema` |
| `disconnect` | mutation | protected | `disconnectConnectorSchema` |
| `updateConfig` | mutation | protected | `updateConnectorConfigSchema` |
| `getGbpAuthUrl` | query | protected | `gbpAuthUrlSchema` |
| `resolveMapsLink` | mutation | protected | `resolveMapsLinkSchema` |
| `handleGbpCallback` | mutation | protected | — |
| `getCalendarAuthUrl` | query | protected | — |
| `handleCalendarCallback` | mutation | protected | — |

**GBP OAuth flow:**
1. Client requests `getGbpAuthUrl({ locationId, redirectUrl? })` → returns Google OAuth URL.
2. User authorizes on Google → redirected to `GOOGLE_REDIRECT_URL` with `code`.
3. Frontend posts the code to `handleGbpCallback` → exchanges for tokens, stores in `connectors.config_secret`.

---

### 11. `coupon`
Coupon templates per workspace, instances issued per customer, redemption flow, AI generation.

- **Service:** `apps/api/src/coupon/coupon.service.ts`
- **Router:** `apps/api/src/coupon/coupon.router.ts`
- **Validators:** `packages/shared/src/validators/coupon.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `listTemplates` | query | protected | `listCouponTemplatesSchema` |
| `createTemplate` | mutation | protected | `createCouponTemplateSchema` |
| `updateTemplate` | mutation | protected | `updateCouponTemplateSchema` |
| `deleteTemplate` | mutation | protected | `deleteCouponTemplateSchema` |
| `issue` | mutation | protected | `issueCouponSchema` |
| `bulkIssue` | mutation | protected | `bulkIssueCouponsSchema` |
| `redeem` | mutation | protected | `redeemCouponSchema` |
| `list` | query | protected | `listCouponsSchema` |
| `stats` | query | protected | `getCouponStatsSchema` |
| `verify` | query | **public** | `verifyCouponSchema` |
| `generateWithAi` | mutation | protected | `generateCouponWithAiSchema` |
| `preflightWhatsApp` | query | protected | `preflightCouponWhatsAppSchema` |
| `sendViaWhatsApp` | mutation | protected | `sendCouponViaWhatsAppSchema` |

`verify` is public so that store staff can scan a customer's QR/code at redemption time without a logged-in session — it only returns the coupon's validity + amount, never owner-private fields.

---

### 12. `customer`
Phonebook per workspace. Customers are subjects of reviews (when matchable), surveys, coupons, automations.

- **Service:** `apps/api/src/customer/customer.service.ts`
- **Router:** `apps/api/src/customer/customer.router.ts`
- **Validators:** `packages/shared/src/validators/customer.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listCustomersSchema` |
| `getById` | query | protected | `getCustomerSchema` |
| `create` | mutation | protected | `createCustomerSchema` |
| `update` | mutation | protected | `updateCustomerSchema` |
| `delete` | mutation | protected | `deleteCustomerSchema` |
| `getReviews` | query | protected | `getCustomerReviewsSchema` |
| `bulkCreate` | mutation | protected | `bulkCreateCustomersSchema` |

Customers don't have a direct `location_id` — location attribution is resolved via subquery on `survey_responses.location_id`.

---

### 13. `cx-routing` (Escalations)
Rules engine for routing negative feedback to the right team member before it becomes a public review. SLA-tracked.

- **Service:** `apps/api/src/cx-routing/cx-routing.service.ts`
- **Router:** `apps/api/src/cx-routing/cx-routing.router.ts`
- **Validators:** `packages/shared/src/validators/cx-routing.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `listRules` | query | protected | `listEscalationRulesSchema` |
| `createRule` | mutation | protected | `createEscalationRuleSchema` |
| `updateRule` | mutation | protected | `updateEscalationRuleSchema` |
| `deleteRule` | mutation | protected | `deleteEscalationRuleSchema` |
| `listEscalations` | query | protected | `listEscalationsSchema` |
| `getEscalation` | query | protected | `getEscalationSchema` |
| `updateEscalation` | mutation | protected | `updateEscalationSchema` |
| `resolveEscalation` | mutation | protected | `resolveEscalationSchema` |
| `addNote` | mutation | protected | — |
| `getStats` | query | protected | `getEscalationStatsSchema` |
| `pauseEscalation` | mutation | protected | — |
| `resumeEscalation` | mutation | protected | — |
| `escalateManual` | mutation | protected | — |
| `bulkAssign` | mutation | protected | — |
| `bulkResolve` | mutation | protected | — |
| `bulkClose` | mutation | protected | — |
| `bulkUpdatePriority` | mutation | protected | — |

States: `open` → `in_progress` → `resolved` / `closed` / `breached`. SLA targets are set per-location via `location.setSlaTarget`.

---

### 14. `email`
Wrapper around Resend. Most email is fired indirectly via [auth](#4-auth), [member](#17-member), [coupon](#11-coupon), [notification](#19-notification).

- **Service:** `apps/api/src/email/email.service.ts`
- **Router:** `apps/api/src/email/email.router.ts`

| Procedure | Type | Auth | Input |
|---|---|---|---|
| `sendTestEmail` | mutation | protected | inline | Admin diagnostic — sends a test email to the calling user. |

Env: `RESEND_API_KEY`, `EMAIL_FROM`.

---

### 15. `listing`
GBP listing accuracy (NAP consistency) + post composition / publishing.

- **Service:** `apps/api/src/listing/listing.service.ts`
- **Router:** `apps/api/src/listing/listing.router.ts`

| Procedure | Type | Auth | Input |
|---|---|---|---|
| `list` | query | protected | inline |
| `getById` | query | protected | inline |
| `getChanges` | query | protected | inline |
| `resolveChange` | mutation | protected | inline |
| `createPost` | mutation | protected | inline |
| `listPosts` | query | protected | inline |
| `sync` | mutation | protected | inline |
| `publishGbpPost` | mutation | protected | `publishGbpPostSchema` |
| `listGbpPosts` | query | protected | `listGbpPostsSchema` |
| `deleteGbpPost` | mutation | protected | `deleteGbpPostSchema` |

`sync` pulls fresh listing data from the connected GBP location; `getChanges` surfaces fields that drifted vs. the workspace canonical (so the owner can resolve or push).

---

### 16. `location`
Physical branches under a workspace. Each can have its own branding overrides + per-location SLA targets.

- **Service:** `apps/api/src/location/location.service.ts`
- **Router:** `apps/api/src/location/location.router.ts`
- **Validators:** `packages/shared/src/validators/location.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `create` | mutation | protected | `createLocationSchema` |
| `list` | query | protected | — |
| `getById` | query | protected | — |
| `update` | mutation | protected | `updateLocationSchema` |
| `delete` | mutation | protected | — |
| `toggleActive` | mutation | protected | — |
| `bulkUpdate` | mutation | protected | — |
| `setSlaTarget` | mutation | protected | — |
| `bulkSetSlaTarget` | mutation | protected | — |
| `getSlaTarget` | query | protected | — |

---

### 17. `member`
Workspace-level memberships. Invite → accept → role.

- **Service:** `apps/api/src/member/member.service.ts`
- **Router:** `apps/api/src/member/member.router.ts`
- **Validators:** `packages/shared/src/validators/member.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | — |
| `invite` | mutation | protected | `inviteMemberSchema` |
| `updateRole` | mutation | protected | `updateMemberRoleSchema` |
| `updateLocations` | mutation | protected | `updateMemberLocationsSchema` |
| `remove` | mutation | protected | `removeMemberSchema` |

Roles: `owner` / `admin` / `manager` / `staff` / `viewer`. `updateLocations` restricts a member to specific locations within the workspace (manager/staff/viewer scoped views).

---

### 18. `nev` (Net Emotion Value)
Emotion-vector scoring of survey responses. Visualized on the dashboard via the `nev-emotion-wheel` chart.

- **Service:** `apps/api/src/nev/nev.service.ts`
- **Router:** `apps/api/src/nev/nev.router.ts`
- **Validators:** `packages/shared/src/validators/nev.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `seedEmotions` | mutation | protected | — |
| `getEmotionDefinitions` | query | **public** | `getEmotionDefinitionsSchema` |
| `submitResponse` | mutation | **public** | `submitNevResponseSchema` |
| `getAnalytics` | query | protected | `getNevAnalyticsSchema` |
| `getTrends` | query | protected | `getNevTrendsSchema` |
| `analyzeText` | mutation | protected | `analyzeNevTextSchema` |

`analyzeText` uses OpenRouter to classify a feedback blurb into the canonical emotion taxonomy.

---

### 19. `notification`
In-app notifications + bell icon. Per-user-per-workspace.

- **Service:** `apps/api/src/notification/notification.service.ts`
- **Router:** `apps/api/src/notification/notification.router.ts`
- **Validators:** `packages/shared/src/validators/notification.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listNotificationsSchema` |
| `markRead` | mutation | protected | `markNotificationReadSchema` |
| `markAllRead` | mutation | protected | `markAllNotificationsReadSchema` |
| `unreadCount` | query | protected | `getUnreadNotificationCountSchema` |

High-priority notifications (low-rating reviews, SLA breaches) ALSO fan out to email via Resend.

---

### 20. `onboarding`
First-run wizard for new workspaces. Industry → brand color → review platform URLs → completion.

- **Service:** `apps/api/src/onboarding/onboarding.service.ts`
- **Router:** `apps/api/src/onboarding/onboarding.router.ts`
- **Validators:** `packages/shared/src/validators/onboarding.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `getState` | query | protected | `getOnboardingStateSchema` |
| `updateStep` | mutation | protected | `updateOnboardingStepSchema` |
| `setFlow` | mutation | protected | `setOnboardingFlowSchema` |
| `getRedirectLinks` | query | protected | `getRedirectLinksSchema` |
| `setRedirectLinks` | mutation | protected | `setRedirectLinksSchema` |
| `searchGooglePlaces` | query | protected | `searchGooglePlacesSchema` |
| `complete` | mutation | protected | `completeOnboardingSchema` |

**Flow types** (`onboardingState.flow`): `direct` / `multi_location` / `agency`.

**Hard gate on `complete`:** at least one platform URL must be set in `workspaces.settings.defaultRedirectLinks` (Google / Zomato / Swiggy) — otherwise `PRECONDITION_FAILED`. Set via `setRedirectLinks` or auto-resolved via `searchGooglePlaces` (Google Places API Text Search, debounced 400ms client-side).

---

### 21. `organization`
Top-level container above workspaces. Owns the white-label flag.

- **Service:** `apps/api/src/organization/organization.service.ts`
- **Router:** `apps/api/src/organization/organization.router.ts`
- **Validators:** `packages/shared/src/validators/organization.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listOrganizationsSchema` |
| `getById` | query | protected | `getOrganizationSchema` |
| `create` | mutation | protected | `createOrganizationSchema` |
| `update` | mutation | protected | `updateOrganizationSchema` |
| `updateType` | mutation | protected | `updateOrganizationTypeSchema` |
| `delete` | mutation | protected | `deleteOrganizationSchema` |
| `switch` | mutation | protected | `switchOrganizationSchema` |
| `clearCurrent` | mutation | protected | — |
| `getCurrent` | query | protected | — |
| `getWhiteLabel` | query | **public** | `getWhiteLabelSchema` |

`getWhiteLabel` is the only public read on this module — called from the public survey pages to resolve the footer override (`white_label.enabled` + `white_label.footerText`).

---

### 22. `organization-member`
Org-level memberships (separate from workspace memberships). Used for agency flows where an admin manages multiple client workspaces.

- **Service:** `apps/api/src/organization/organization-member.service.ts`
- **Router:** `apps/api/src/organization/organization-member.router.ts`
- **Validators:** `packages/shared/src/validators/organization.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listOrganizationMembersSchema` |
| `invite` | mutation | protected | `inviteOrganizationMemberSchema` |
| `acceptInvite` | mutation | protected | `acceptOrganizationInviteSchema` |
| `updateRole` | mutation | protected | `updateOrganizationMemberRoleSchema` |
| `remove` | mutation | protected | `removeOrganizationMemberSchema` |
| `assignToWorkspaces` | mutation | protected | `assignMemberToWorkspacesSchema` |

---

### 23. `qr`
QR code management — persistent registry per workspace, click tracking, downloads.

- **Service:** `apps/api/src/qr/qr.service.ts`
- **Router:** `apps/api/src/qr/qr.router.ts`
- **Validators:** `packages/shared/src/validators/qr.ts`
- **DB schema:** `packages/db/src/schema/qr-codes.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listQrCodesSchema` |
| `create` | mutation | protected | `createQrCodeSchema` |
| `update` | mutation | protected | `updateQrCodeSchema` |
| `archive` | mutation | protected | `archiveQrCodeSchema` |
| `download` | mutation | protected | `downloadQrCodeSchema` |
| `recordClick` | mutation | **public** | `recordQrClickSchema` |
| `generateJourneyQr` | query | protected | `generateJourneyQrSchema` |
| `generateFormQr` | mutation | protected | `generateFormQrSchema` |
| `generateBulkQr` | mutation | protected | `generateBulkQrSchema` |

`recordClick` is public — called from the `/q/[shortCode]` Next.js route handler. Atomically increments `clickCount`. Archived QRs still redirect (so printed stickers don't 404) but freeze the counter.

Short codes are 8-char base64url (`randomBytes(6).toString('base64url')`). The `download` endpoint regenerates the QR encoding the **tracking URL** so every scan increments the counter.

---

### 24. `rais` (AI Studio)
AI-drafted social content — GBP posts, captions, hashtags, content ideas. Credit-metered.

- **Service:** `apps/api/src/rais/rais.service.ts`
- **Router:** `apps/api/src/rais/rais.router.ts`
- **Validators:** `packages/shared/src/validators/rais.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `getCredits` | query | protected | `getCreditsSchema` |
| `getCreditLog` | query | protected | `getCreditLogSchema` |
| `analyzeReviews` | mutation | protected | `analyzeReviewsSchema` |
| `generatePostIdeas` | mutation | protected | `generatePostIdeasSchema` |
| `generatePost` | mutation | protected | `generatePostSchema` |
| `regenerateElement` | mutation | protected | `regenerateElementSchema` |
| `schedulePost` | mutation | protected | `schedulePostSchema` |
| `getRecentTrends` | mutation | protected | `getRecentTrendsSchema` |
| `getIndustryOpportunities` | mutation | protected | `getIndustryOpportunitiesSchema` |
| `makeYourOwnPost` | mutation | protected | `makeYourOwnPostSchema` |
| `generateCaption` | mutation | protected | `generateCaptionSchema` |
| `generateHashtags` | mutation | protected | `generateHashtagsSchema` |
| `generateContentIdeas` | mutation | protected | `generateContentIdeasSchema` |
| `generateImagePrompt` | mutation | protected | `generateImagePromptSchema` |
| `listPosts` | query | protected | `listPostsSchema` |
| `createPost` | mutation | protected | `createPostSchema` |
| `updatePost` | mutation | protected | `updatePostSchema` |
| `deletePost` | mutation | protected | `deletePostSchema` |
| `getBrandVoice` | query | protected | `getBrandVoiceSchema` |
| `updateBrandVoice` | mutation | protected | `updateBrandVoiceSchema` |
| `getCalendar` | query | protected | `getCalendarSchema` |
| `getContentStats` | query | protected | `getContentStatsSchema` |

Every AI generation decrements workspace credits; credits replenish per billing plan. `regenerateElement` lets the owner re-roll a single element (caption, hashtag set, image idea) without burning a full credit.

---

### 25. `report`
Workspace analytics — generate, view, export, share. PDF export via headless rendering.

- **Service:** `apps/api/src/report/report.service.ts`
- **Router:** `apps/api/src/report/report.router.ts`
- **Validators:** `packages/shared/src/validators/report.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `generate` | mutation | protected | `generateReportSchema` |
| `get` | query | protected | `getReportSchema` |
| `list` | query | protected | `listReportsSchema` |
| `delete` | mutation | protected | `deleteReportSchema` |
| `share` | mutation | protected | `shareReportSchema` |
| `exportPdf` | mutation | protected | `exportPdfSchema` |
| `getShared` | query | **public** | `getSharedReportSchema` |

`share` creates a tokenized public URL. `getShared` accepts the token and returns the report data without authentication — used for sharing with external stakeholders.

---

### 26. `review`
Inbox + reply lifecycle. Drives the canonical `/dashboard/inbox` daily-driver page.

- **Service:** `apps/api/src/review/review.service.ts`
- **Router:** `apps/api/src/review/review.router.ts`
- **Validators:** `packages/shared/src/validators/review.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `list` | query | protected | `listReviewsSchema` |
| `getById` | query | protected | `getReviewSchema` |
| `sync` | mutation | protected | `syncReviewsSchema` |
| `syncAll` | mutation | protected | `syncAllReviewsSchema` |
| `stats` | query | protected | `reviewStatsSchema` |
| `analytics` | query | protected | `reviewAnalyticsSchema` |
| `generateResponse` | mutation | protected | `generateResponseSchema` |
| `bulkGenerateResponses` | mutation | protected | `bulkGenerateResponsesSchema` |
| `approveResponse` | mutation | protected | `approveResponseSchema` |
| `rejectResponse` | mutation | protected | `rejectResponseSchema` |
| `editResponse` | mutation | protected | `editResponseSchema` |
| `postResponse` | mutation | protected | `postResponseSchema` |
| `respond` | mutation | protected | `respondToReviewSchema` |
| `deleteReply` | mutation | protected | `deleteReviewReplySchema` |
| `listPendingAiApprovals` | query | protected | — |

Reply lifecycle: `draft` → `approved` → `posted` (or `rejected` along the way). `sync` pulls from one connector; `syncAll` walks every active connector in the workspace.

---

### 27. `survey`
Unified surveys engine — journeys (multi-screen branching) + truforms (deep, single classical metric). 4 templates (`quick`, `deep`, `adaptive`, `custom`).

- **Service:** `apps/api/src/surveys/survey-engine.service.ts` + `survey-crud.service.ts` + `adaptive-engine.service.ts`
- **Router:** `apps/api/src/surveys/survey.router.ts`
- **Branding helper:** `apps/api/src/surveys/branding.helper.ts`
- **Validators:** `packages/shared/src/validators/survey.ts` + `survey-steps.ts` + `survey-wizard.ts`

| Procedure | Type | Auth | Input schema | Purpose |
|---|---|---|---|---|
| `getInitialState` | query | **public** | `getInitialStateSchema` | Mount-time fetch by `SurveyEngineRenderer`. Returns first step + branding + sessionId. |
| `advance` | mutation | **public** | `advanceSchema` | Step-by-step walker. Auto-traverses internal branch steps. 32-hop cycle cap. |
| `complete` | mutation | **public** | `completeSchema` | Terminal — writes `survey_responses` + upserts `customers`. Short-circuits on `preview: true`. |
| `submitLegacyJourney` | mutation | **public** | `submitLegacyJourneySchema` | Legacy compat shim (kept for backwards-compatible URLs). |
| `submitLegacyTruform` | mutation | **public** | `submitLegacyTruformSchema` | Legacy compat shim. |
| `getPublicLegacyJourney` | query | **public** | `getPublicLegacyJourneySchema` | Legacy compat shim. |
| `getPublicLegacyTruform` | query | **public** | `getPublicLegacyTruformSchema` | Legacy compat shim. |
| `generateHappyReviewDraft` | mutation | **public** | `generateHappyReviewDraftSchema` | Composes AI review text for the customer's clipboard on Journey A Step 3a.1 (happy YES). |
| `list` | query | protected | `listSurveysSchema` | Workspace surveys list with filters. |
| `getById` | query | protected | `getSurveyByIdSchema` | Owner-facing survey detail. |
| `create` | mutation | protected | `createSurveySchema` | Create a survey (intelligent or builder mode). |
| `createFromWizard` | mutation | protected | `createSurveyFromWizardSchema` | Custom-journey wizard atomic create — short-circuits to `template='adaptive'` when metric='random'. |
| `update` | mutation | protected | `updateSurveySchema` | Update steps[] / settings / name / status. |
| `archive` | mutation | protected | `archiveSurveySchema` | Soft-archive (sets `archivedAt`). |
| `listResponses` | query | protected | `listSurveyResponsesSchema` | Filterable responses for a workspace or single survey. |
| `getResponseById` | query | protected | `getSurveyResponseByIdSchema` | Single response detail (used by the Responses tab's side sheet). |

**Engine semantics:**
- `advance` returns `{ done: false, nextStep }` for renderable steps OR `{ done: true, terminalStep }` for end_journey.
- Internal step kinds (`branch_by_score`, `branch_by_answer`) are auto-traversed server-side — the FE never sees them.
- `preview: true` propagates through all three: drops `status='active'` filter, skips `survey_starts` insert, and short-circuits `complete()` with no writes.

---

### 28. `wapisnap` (WhatsApp messaging)
External WhatsApp gateway. Talks to the WapiSnap Bridge service over HMAC-SHA256 signed HTTP.

- **Service:** `apps/api/src/wapisnap/wapisnap.service.ts`
- **Router:** `apps/api/src/wapisnap/wapisnap.router.ts`
- **Validators:** `packages/shared/src/validators/wapisnap.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `provision` | mutation | protected | `wapisnapProvisionSchema` |
| `getStatus` | query | protected | `wapisnapGetStatusSchema` |
| `sendReviewRequest` | mutation | protected | `wapisnapSendReviewRequestSchema` |
| `sendCoupon` | mutation | protected | `wapisnapSendCouponSchema` |
| `listTemplates` | query | protected | `wapisnapListTemplatesSchema` |
| `syncTemplates` | mutation | protected | `wapisnapSyncTemplatesSchema` |
| `createSequence` | mutation | protected | `wapisnapCreateSequenceSchema` |
| `cancelSequence` | mutation | protected | `wapisnapCancelSequenceSchema` |
| `getDeliveryStats` | query | protected | `wapisnapGetDeliveryStatsSchema` |
| `pause` | mutation | protected | `wapisnapPauseSchema` |
| `resume` | mutation | protected | `wapisnapResumeSchema` |

Env: `WAPISNAP_BRIDGE_URL`, `WAPISNAP_BRIDGE_SECRET`. See `INTEGRATION_PROPOSAL_V6_BRIDGE.md` for the architecture rationale.

---

### 29. `workspace`
The tenancy unit. Every domain row in the system is scoped to a workspace.

- **Service:** `apps/api/src/workspace/workspace.service.ts`
- **Router:** `apps/api/src/workspace/workspace.router.ts`
- **Validators:** `packages/shared/src/validators/workspace.ts`

| Procedure | Type | Auth | Input schema |
|---|---|---|---|
| `create` | mutation | protected | `createWorkspaceSchema` |
| `list` | query | protected | — |
| `getById` | query | protected | — |
| `update` | mutation | protected | `updateWorkspaceSchema` |
| `delete` | mutation | protected | — |
| `globalSearch` | query | protected | — |

`globalSearch` is the Cmd-K command-palette source — fuzzy-searches across customers, reviews, surveys, journeys, members within the active workspace.

---

## Database Schemas

All schemas live in `packages/db/src/schema/` and are exported via `@rectangled/db`.

| Schema file | Tables |
|---|---|
| `users.ts` | `users` |
| `organizations.ts` | `organizations` |
| `organization-members.ts` | `organization_members` |
| `workspaces.ts` | `workspaces` |
| `locations.ts` | `locations` |
| `members.ts` | `members` |
| `customers.ts` | `customers` |
| `connectors.ts` | `connectors` |
| `reviews.ts` | `reviews`, `review_responses` |
| `listings.ts` | `listings`, `listing_changes`, `gbp_posts` |
| `surveys.ts` | `surveys`, `survey_responses`, `survey_starts` (+ enums `survey_template`, `survey_mode`, `survey_status`) |
| `qr-codes.ts` | `qr_codes` (+ enums `qr_target_type`, `qr_status`) |
| `coupons.ts` | `coupon_templates`, `coupons` |
| `cx-routing.ts` | `cx_rules`, `cx_escalations`, `cx_notes` |
| `nev.ts` | `nev_emotions`, `nev_responses` |
| `cli.ts` | `cli_responses`, `cli_segments` |
| `automations.ts` | `automation_rules`, `automation_queue`, `automation_cooldowns` |
| `notifications.ts` | `notifications` |
| `reports.ts` | `reports`, `report_shares` |
| `business-aspects.ts` | `business_aspects` |
| `onboarding.ts` | `onboarding_state` |
| `appointments.ts` | `appointments` |
| `rais.ts` | `rais_posts`, `rais_credit_log` |
| `ai-schedules.ts` | `ai_response_schedules`, `ai_response_daily_counts` |
| `wapisnap.ts` | `wapisnap_provisions`, `wapisnap_sequences`, `wapisnap_deliveries` |
| `billing.ts` | `subscriptions`, `invoices` |
| `internal-jobs.ts` | `internal_jobs` |
| `password-reset-tokens.ts` | `password_reset_tokens` |
| `refresh-tokens.ts` | `refresh_tokens` |

**Migrations** live in `scripts/migrations/NNNN_*.sql` and are applied by `scripts/migrate.mjs` (idempotent — tracking table `_app_migrations`). The API container runs pending migrations on every boot per `Dockerfile.api`'s `CMD`.

For the `qr_codes` table specifically, there's also an inline fallback in `apps/api/src/main.ts → ensureQrCodesSchema()` that runs before `app.listen()`. This was added in commit `d343ba7` after migration 0022 failed to apply on the live deploy via the Dockerfile path (root cause: still under investigation — either `scripts/migrations/` isn't being COPY'd into the runner image, or `migrate.mjs` is failing without propagating its exit code). The inline path uses `CREATE TABLE IF NOT EXISTS` + `DO $$` enum guards so it's safe to keep running indefinitely.

---

## Environment Variables

Required (will throw on first use if unset):
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — secret for signing JWTs

Optional (graceful degradation):
- `JWT_EXPIRY` — default `30d`
- `REDIS_URL` — used by rate limiter; falls back to in-memory if unset
- `OPENROUTER_API_KEY` + `OPENROUTER_BASE_URL` + `AI_MODEL` — AI features fall back to static templates if unset
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URL` — GBP OAuth
- `GOOGLE_API_KEY` — Google Places API (onboarding search)
- `RESEND_API_KEY` + `EMAIL_FROM` — email sending
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` + `RAZORPAY_WEBHOOK_SECRET` — billing
- `WAPISNAP_BRIDGE_URL` + `WAPISNAP_BRIDGE_SECRET` — WhatsApp gateway
- `API_PORT` — default `3001`
- `NEXT_PUBLIC_API_URL` — used by FE to reach the API
- `NEXT_PUBLIC_APP_URL` — base URL for generating QR + redirect URLs server-side

---

## Procedure Count by Module

| Module | Count |
|---|---|
| ai-agent | 2 |
| ai-response | 8 |
| appointment | 6 |
| auth | 10 |
| automation | 7 |
| billing | 5 |
| business-aspect | 6 |
| chain | 6 |
| cli | 5 |
| connector | 10 |
| coupon | 13 |
| customer | 7 |
| cx-routing | 17 |
| email | 1 |
| listing | 10 |
| location | 10 |
| member | 5 |
| nev | 6 |
| notification | 4 |
| onboarding | 7 |
| organization | 10 |
| organization-member | 6 |
| qr | 9 |
| rais | 22 |
| report | 7 |
| review | 15 |
| survey | 16 |
| wapisnap | 11 |
| workspace | 6 |
| **Total** | **247** |

---

## Further Reading

- **Architecture & domain notes:** `obsidian/` vault — open the folder as an Obsidian vault for the cross-linked graph view. Hub at `obsidian/00-Index.md`.
- **Codebase context:** `CLAUDE.md` at repo root.
- **Hotfix log:** `obsidian/concepts/Hotfix-Trail.md` — chronological record of every shipped change with commit hash + files-touched.
- **Customer journeys (data flows):** `obsidian/concepts/Customer-Journeys.md` — every customer-facing flow with module dependencies.
- **PRD:** `OptimizerV6_Blueprint_V3_1.docx` — original product spec (not in repo).
- **WapiSnap bridge spec:** `INTEGRATION_PROPOSAL_V6_BRIDGE.md`.

---

_Last refreshed for commits up to `6720c00` (vault cleanup). Procedure list extracted programmatically from `apps/api/src/*/*.router.ts` — re-run the extractor if router signatures change._
