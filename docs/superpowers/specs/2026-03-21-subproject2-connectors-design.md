# Sub-Project 2: Connectors & Integrations — Design Spec

**Date:** 2026-03-21
**Scope:** 3 features — Email connector (SendGrid/Resend), Google Calendar appointments, GBP Posts wiring

---

## 1. Email Connector (SendGrid/Resend)

**Problem:** Customers can't use their own email provider. All emails go through Rectangled's system Resend key.

**Solution:** Let customers connect their own SendGrid or Resend API key, which replaces the system email for all workspace emails.

### Connector Setup:
- Activate the existing `email` connector type in the seed data (`authType: 'api_key'`, `bindingLevel: 'workspace'`)
- Credentials schema: `{ provider: 'sendgrid' | 'resend', apiKey: string, fromEmail: string }`

### Connect Flow:
1. Customer opens connector page, clicks "Connect" on Email
2. ConnectorConnectSheet shows: provider selector (SendGrid/Resend), API key input, From Email input
3. On submit: creates connector instance with credentials
4. "Send Test Email" button to verify the key works

### Email Service Integration:
- `email.service.ts` modified: before sending, check if workspace has a connected email connector instance
- If found: use that provider's API key and fromEmail
- If not found: fall back to system Resend key
- New `sendgrid.adapter.ts`: lightweight adapter using `fetch` to `api.sendgrid.com/v3/mail/send` (no SDK)

### Files Affected:
- `apps/api/src/connector/connector.service.ts` — update seed to activate email connector
- `apps/api/src/connector/adapters/sendgrid.adapter.ts` — new file
- `apps/api/src/email/email.service.ts` — add workspace-aware provider selection
- `apps/web/src/components/connector/connector-connect-sheet.tsx` — add email-specific form fields
- `packages/shared/src/constants/connectors.ts` — ensure email connector is listed

---

## 2. Google Calendar — Appointment Scheduling

**Problem:** No way for customers to book appointments at business locations.

**Solution:** Google Calendar integration for appointment scheduling per location.

### Connector:
- New connector type: `google_calendar`, `authType: 'oauth2'`, `bindingLevel: 'location'`
- OAuth flow reuses existing Google OAuth pattern from GBP, with Calendar API scopes (`calendar.events`, `calendar.readonly`)

### New Adapter:
`apps/api/src/connector/adapters/calendar.adapter.ts`:
- `getAuthUrl()` — Google OAuth with calendar scopes
- `exchangeCode()` — code → tokens
- `refreshAccessToken()` — token refresh
- `listCalendars()` — list user's calendars
- `listAvailableSlots(calendarId, dateFrom, dateTo)` — free/busy query
- `createEvent(calendarId, event)` — create calendar event
- `cancelEvent(calendarId, eventId)` — cancel event

### Database:
New `appointments` table:
```
id (uuid PK)
workspaceId (FK → workspaces)
locationId (FK → locations)
customerId (FK → customers, nullable)
connectorInstanceId (FK → connectorInstances)
calendarEventId (varchar) — Google Calendar event ID
customerName (varchar)
customerEmail (varchar)
customerPhone (varchar)
title (varchar)
startTime (timestamp)
endTime (timestamp)
status (enum: scheduled, completed, cancelled, no_show)
notes (text)
createdAt, updatedAt
```

### New API Module:
`apps/api/src/appointment/` with:
- `appointment.service.ts` — CRUD + availability checking
- `appointment.router.ts` — tRPC procedures:
  - `listAvailableSlots` (public) — check availability
  - `book` (public) — create appointment
  - `list` — list appointments for workspace/location
  - `cancel` — cancel appointment
  - `updateStatus` — mark completed/no_show
- `appointment.module.ts`

### Frontend:
- Add to connector seed: `google_calendar` type
- Add OAuth flow in ConnectorConnectSheet for calendar (same pattern as GBP)
- New `/dashboard/appointments` page — list and manage appointments
- Public booking page at `/book/[locationSlug]` — customer-facing slot picker and booking form

### Files:
- `packages/db/src/schema/appointments.ts` — new schema
- `packages/db/src/schema/enums.ts` — add appointmentStatusEnum
- `packages/db/src/schema/index.ts` — export new schema
- `packages/shared/src/validators/appointment.ts` — new validators
- `apps/api/src/connector/adapters/calendar.adapter.ts` — new adapter
- `apps/api/src/appointment/*` — new module
- `apps/web/src/app/dashboard/appointments/page.tsx` — new page
- `apps/web/src/app/book/[slug]/page.tsx` — public booking page
- `apps/web/src/components/dashboard/sidebar.tsx` — add Appointments nav item

---

## 3. GBP Posts — Wire Frontend to Backend

**Problem:** GBP adapter has post CRUD methods but the listings/posts frontend page may not be fully wired.

**Solution:** Audit and connect the existing frontend to the existing backend.

### Approach:
- Audit `apps/web/src/app/dashboard/listings/posts/page.tsx` for what it currently renders
- Ensure the "Create Post" form calls `listing.publishGbpPost` procedure
- Ensure published posts display via `listing.listGbpPosts` procedure
- Add delete functionality via `listing.deleteGbpPost` procedure
- Support post types: Standard update, Event, Offer

### Files Affected:
- `apps/web/src/app/dashboard/listings/posts/page.tsx` — wire to tRPC procedures
- `apps/api/src/listing/listing.service.ts` — verify post methods are complete
- `apps/api/src/listing/listing.router.ts` — verify procedures exist

---

## Implementation Order

1. **Email connector** (smallest, leverages existing infrastructure)
2. **GBP Posts wiring** (no new backend, just frontend connections)
3. **Google Calendar** (largest, new module + OAuth + public page)
