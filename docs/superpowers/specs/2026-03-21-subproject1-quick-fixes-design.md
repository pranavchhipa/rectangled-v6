# Sub-Project 1: Quick UI Fixes & Data Display — Design Spec

**Date:** 2026-03-21
**Scope:** 14 issues across Dashboard, Locations, Inbox, Escalations, Analytics, Automations, Settings, Customers
**Approach:** Fix-first — all quick fixes and UI improvements before tackling major feature builds

---

## 1. Dashboard — Global Search (Command Palette)

**Problem:** Search bar in header is disabled (`<input disabled>`), not clickable.

**Solution:** Replace with a Command Palette (shadcn `<Dialog>` + `<Command>`).

- **Trigger:** Click search bar OR `Ctrl+K` / `Cmd+K`
- **Scope:** Searches across customers (name/phone/email), reviews (text/reviewer), coupons (code/name), locations (name/city), tags, aspects
- **Backend:** New `workspace.globalSearch` tRPC procedure — parallel `ILIKE` queries across tables, returns categorized results (max 5 per category)
- **Performance:** Consider adding `pg_trgm` GIN indexes on frequently searched text columns (customer name, review text) if performance degrades. For MVP, `ILIKE` with `LIMIT 5` per table is acceptable given workspace-scoped queries.
- **UI:** Results grouped by type with icons; clicking navigates to relevant page/item
- **Debounce:** 300ms on input

**Files affected:**
- `apps/web/src/components/dashboard/header.tsx` — replace disabled input with CommandDialog trigger
- `apps/web/src/components/dashboard/global-search.tsx` — new component
- `apps/api/src/workspace/workspace.service.ts` — add globalSearch method
- `apps/api/src/workspace/workspace.router.ts` — add globalSearch procedure

---

## 2. Dashboard — Remove "System Healthy" Indicator

**Problem:** Static green dot with "System healthy" text — no real health check behind it.

**Solution:** Remove the div entirely. It's misleading.

**Files affected:**
- `apps/web/src/app/dashboard/page.tsx` — remove the "System healthy" div (lines 110-115)

---

## 3. Locations — Connector Icons on Cards

**Problem:** Location cards don't show which review platforms are connected.

**Solution:** Show small platform icons (Google, Zomato, etc.) on each location card.

- Query `connector.listInstances` on the locations page to get connector-to-location mapping
- In `LocationCard`, add a row of 16x16 platform SVG icons below the address
- If no connectors linked: subtle "No platforms connected" text
- New `components/ui/platform-icons.tsx` with inline SVG icons for Google, Zomato, Facebook

**Files affected:**
- `apps/web/src/components/ui/platform-icons.tsx` — new file
- `apps/web/src/components/location/location-card.tsx` — add connector icons row
- `apps/web/src/app/dashboard/locations/page.tsx` — pass connector data to cards

---

## 4. Locations — Store Owner Name Field

**Problem:** No owner name field in location form.

**Solution:** Add `ownerName` field to location schema, form, and card.

- **DB:** Add `ownerName` varchar nullable column to `locations` table
- **Validator:** Update location create/update validators in shared package
- **Service/Router:** Accept and persist `ownerName`
- **Form:** Add field after Name in `LocationFormSheet`
- **Card:** Display owner name if present

**Files affected:**
- `packages/db/src/schema/locations.ts` — add ownerName column
- `packages/shared/src/validators/location.ts` — add ownerName to schemas
- `apps/api/src/location/location.service.ts` — handle ownerName
- `apps/api/src/location/location.router.ts` — pass through ownerName
- `apps/web/src/components/location/location-form-sheet.tsx` — add field
- `apps/web/src/components/location/location-card.tsx` — display owner

---

## 5. Inbox — Show Location Name + Capture Date

**Problem:** Reviews don't show which location they were captured from or when.

**Solution:** Add location name badge and relative timestamp to review cards.

- Location name as a subtle tag next to platform badge (e.g., "Google | Mumbai HQ")
- Capture date (`reviewedAt`) as relative time ("2 days ago") with full date in tooltip
- Data already in reviews table — join location name or pass through from query

**Files affected:**
- `apps/web/src/app/dashboard/inbox/page.tsx` — display location + date in review items
- `apps/api/src/review/review.service.ts` — ensure location name is included in list response

---

## 6. Inbox — Granular Date Filter

**Problem:** Date range filter only has 7d/30d/90d/all options.

**Solution:** Enhanced date filter with presets + custom calendar picker.

- Preset buttons: Today, 7 days, 14 days, 30 days, 90 days, All
- Custom date range picker: shadcn `<Calendar>` + `<Popover>` for arbitrary ranges
- Filter state passed to backend query

**Files affected:**
- `apps/web/src/app/dashboard/inbox/page.tsx` — replace date select with enhanced filter
- `apps/web/src/components/ui/date-range-picker.tsx` — new reusable component (shared with analytics)

---

## 7. Inbox — Fix Search

**Problem:** Search input exists but doesn't filter reviews.

**Solution:** Wire search to review list query with debounced text search.

- Search by reviewer name, review text, and themes
- Backend: The `search` param already exists in `listReviewsSchema` validator. Ensure the service actually applies it as an `ILIKE` filter on `reviewerName`, `text`, and `themes` columns.
- Frontend: Debounce 300ms, pass to query

**Files affected:**
- `apps/web/src/app/dashboard/inbox/page.tsx` — wire search state to query
- `apps/api/src/review/review.service.ts` — implement search filtering (search param already in validator)

---

## 8. Escalations — Show Location, Reviewer, Date

**Problem:** Escalated reviews don't show location, reviewer name, or capture date.

**Solution:** Same pattern as inbox — join location name, pull reviewer name from linked review, show timestamp.

**Files affected:**
- `apps/web/src/app/dashboard/escalations/page.tsx` — display additional fields
- `apps/api/src/cx-routing/cx-routing.service.ts` — include location/reviewer data in escalation queries

---

## 9. Escalations — Transform SLA into Ticket System

**Problem:** SLA/deadline/expired logic doesn't fit the service model (Rectangled manages this, not customers).

**Solution:** Simple ticket system with status flow.

### DB Changes:
- Add `ticketNumber` (integer) to escalations table — auto-assigned per workspace
- Add `activityLog` (jsonb, default `[]`) to escalations table — array of `{text: string, authorId: string, authorName: string, timestamp: string}` entries. Keep existing `notes` text column untouched for backward compat.
- Add `closed` to `escalationStatusEnum` — becomes `['open', 'in_progress', 'resolved', 'expired', 'closed']`. `expired` kept for DB compat but hidden from UI.
- Run `drizzle-kit push` after schema changes

### Status Flow:
- `open` → `in_progress` → `resolved` | `closed`
- `expired` status hidden from UI (kept in enum for existing data)

### Ticket Number Generation (race-condition safe):
- Use `INSERT ... RETURNING` with a subquery: `COALESCE((SELECT MAX(ticketNumber) FROM escalations WHERE workspaceId = $1), 0) + 1`
- Combined with a unique constraint on `(workspaceId, ticketNumber)` — if a race causes a duplicate, the insert fails and is retried (max 3 attempts)

### UI Changes:
- Remove: SLA timers, deadline indicators, breach warnings, "expired" badges
- Add: Ticket # display (#TKT-001), assignee dropdown (team members), priority selector, activity log panel (timestamped entries with author), status change dropdown

### Backend:
- Ticket number generation with retry on unique constraint violation
- Activity log: append entries with author + timestamp via `jsonb_array_append`
- Status transitions: validate allowed transitions (open→in_progress, in_progress→resolved/closed)

**Files affected:**
- `packages/db/src/schema/cx-routing.ts` — add ticketNumber, activityLog columns
- `packages/db/src/schema/enums.ts` — add 'closed' to escalationStatusEnum
- `apps/api/src/cx-routing/cx-routing.service.ts` — ticket number gen, activity log management
- `apps/api/src/cx-routing/cx-routing.router.ts` — update procedures
- `apps/web/src/app/dashboard/escalations/page.tsx` — full UI overhaul

**Note:** This is the largest item in Sub-Project 1. It's essentially a small feature build and should be implemented last within this sub-project to avoid blocking other quick fixes.

---

## 10. Analytics — Date Filter with Calendar + Platform Filter

**Problem:** Simple dropdown with only 7d/30d/90d options, no platform filter.

**Solution:**
- Replace with date range picker (reuse component from #6)
- Add platform multi-select filter: All, Google, Zomato
- Both filters passed to `review.analytics` query params

**Files affected:**
- `apps/web/src/app/dashboard/analytics/page.tsx` — replace date select, add platform filter
- `apps/api/src/review/review.service.ts` — accept platform filter in analytics query
- `packages/shared/src/validators/review.ts` — add `platform` field to `reviewAnalyticsSchema`

---

## 11. Analytics — Persistent Info Tooltips

**Problem:** CLI, NPS, CSAT, NEV, Sentiment, Aspects, Health Score shown without explanation.

**Solution:** Reusable `<InfoTooltip>` component with plain-English explanations.

- Small `?` circle icon next to metric titles
- Hover/click shows tooltip with explanation
- Definitions:
  - NPS: "Net Promoter Score — how likely customers recommend your business (0-100)"
  - CSAT: "Customer Satisfaction Score — direct happiness measure (1-5)"
  - CLI: "Customer Loyalty Index — trust + satisfaction + advocacy composite (0-100)"
  - NEV: "Net Emotional Value — positive vs negative emotion ratio (-100 to +100)"
  - Sentiment: "Overall emotional tone — positive, negative, neutral, or mixed"
  - Aspects: "Business elements customers mention — food, service, ambiance, etc."
  - Health Score: "Composite of rating, response rate, sentiment, velocity (0-100)"

**Files affected:**
- `apps/web/src/components/ui/info-tooltip.tsx` — new reusable component
- `apps/web/src/app/dashboard/analytics/page.tsx` — add tooltips to metric titles
- Various chart components — add tooltips where metrics appear

---

## 12. Automations — Rename Page

**Problem:** "Automations" is vague; the page manages post-review automated actions.

**Solution:** Rename to **"Post-Review Actions"**.

**Files affected:**
- `apps/web/src/app/dashboard/automations/page.tsx` — update title
- `apps/web/src/components/dashboard/sidebar.tsx` — update nav label
- Any breadcrumb or link references

---

## 13. Settings — Merge Settings + Billing + Admin

**Problem:** Three separate pages for related configuration.

**Solution:** Single `/settings` page with tabs:
- **General** — workspace settings (name, industry, logo, brand colors, tone)
- **Team** — members table + invite
- **AI Settings** — AI response config
- **Billing** — current plan, invoices, upgrade/cancel
- **Admin** — admin-level controls

**Migration:**
- Move billing page content into Billing tab
- Move admin page content into Admin tab
- Set up redirects: `/billing/page.tsx` and `/admin/page.tsx` use Next.js `redirect()` to `/dashboard/settings?tab=billing` and `/dashboard/settings?tab=admin`
- Settings page uses `useSearchParams()` hook to read `?tab=` param and set initial active tab
- Update sidebar: single "Settings" entry with gear icon

**Files affected:**
- `apps/web/src/app/dashboard/settings/page.tsx` — add billing + admin tabs
- `apps/web/src/app/dashboard/billing/page.tsx` — redirect to settings
- `apps/web/src/app/dashboard/admin/page.tsx` — redirect to settings
- `apps/web/src/components/dashboard/sidebar.tsx` — remove billing/admin nav items

---

## 14. Customers — Bulk Upload

**Problem:** No way to import customers in bulk.

**Solution:** Upload button with CSV/XLSX support + sample file download.

### UI:
- "Upload Customers" button next to "Add Customer"
- Opens dialog with:
  - "Download Sample" link → sample .xlsx with headers: Name, Email, Phone, Tags
  - File drop zone for .csv / .xlsx
  - Preview table of parsed rows
  - "Import" button

### Backend:
- New `customer.bulkCreate` tRPC procedure
- Accepts array of `{name, email?, phone?, tags?}`
- Validates uniqueness per workspace (skip duplicates)
- Returns `{created: number, skipped: number, errors: string[]}`

### Constraints:
- Max file size: 5MB
- Max rows: 1000 per upload
- Malformed files: show error toast with parse failure message, reject entirely

### Dependencies:
- `xlsx` npm package (frontend, mini build) for parsing uploaded files
- Sample file generated client-side using same library

**Files affected:**
- `apps/web/src/app/dashboard/customers/page.tsx` — add upload button
- `apps/web/src/components/customer/customer-upload-dialog.tsx` — new component
- `apps/api/src/customer/customer.service.ts` — add bulkCreate method
- `apps/api/src/customer/customer.router.ts` — add bulkCreate procedure
- `packages/shared/src/validators/customer.ts` — add bulk create schema
- `apps/web/package.json` — add xlsx dependency

---

## Implementation Order

1. Shared components first: `InfoTooltip`, `DateRangePicker`, `PlatformIcons`
2. DB schema changes: `ownerName` on locations, `ticketNumber` + `activityLog` on escalations, `closed` added to escalation status enum → run `drizzle-kit push`
3. Shared package changes: update validators → rebuild shared package
4. Backend changes: globalSearch, review search, bulk customer create, ticket system
5. Frontend fixes in order: Dashboard → Locations → Inbox → Analytics → Automations → Settings → Customers → Escalations (last, largest item)

---

## Out of Scope (Sub-Projects 2-6)
- Connector integrations (SendGrid, Google Calendar)
- Analytics + Reports merge
- Journey visual builder + platform step
- AI Agent chatbot
- AI coupon creation
- TruForms visual builder
