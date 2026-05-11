---
type: architecture
aliases: [apps/web, Web, Next.js App]
---

# apps/web — Next.js 15 Web

Path: `apps/web/`. Port `3000`. App Router.

## Routes (`apps/web/src/app/`)

### Public (unauthenticated)
- `(auth)` group, `auth/` — login + accept-invite flows ([[Auth]])
- `j/[slug]` → [[Public-Pages]] · journey-based feedback
- `f/[slug]` → [[Public-Pages]] · single-screen truform
- `book/` — appointment booking ([[Appointments]])
- `accept-invite/` — workspace invite acceptance ([[Members]])

### Dashboard (`dashboard/*`)
- `dashboard/page.tsx` — overview with rollups
- `inbox/` — **canonical** review workflow surface (table + detail sheet) ([[Reviews]], [[AI-Response]])
- `responses/` — survey-response feed ([[Surveys]])
- `analytics/` — 13 chart components, see [[Reports]]
- `journeys/`, `journeys/[id]/` — **canonical** journeys/surveys builder ([[Surveys]])
- `qr/` — [[QR|QR Code Management]] · per-workspace registry with click tracking
- `q/[shortCode]/route.ts` — public scan handler (route handler, not a page); records click → 302 redirects
- `coupons/` — [[Coupons]]
- `escalations/` — [[Escalations]]
- `automations/` — [[Automations]]
- `rais/` — [[RAIS]] (AI Studio)
- `customers/` — [[Customers]]
- `connectors/` — [[Connectors]]
- `locations/` — [[Locations]]
- `members/` — [[Members]]
- `onboarding/` — [[Onboarding]]
- `listings/`, `listings/[id]/`, `listings/posts/` — [[Listings]]
- `reports/`, `reports/[id]/` — [[Reports]]
- `billing/` — [[Billing]]
- `settings/` — workspace + branding settings
- `appointments/` — [[Appointments]]
- `chain/` — [[Chain]]
- `organization/` — [[Organization]]
- `admin/`, `admin/billing/` — internal admin

## Components (`apps/web/src/components/`)
Domain-grouped folders:
- `analytics/` — 13 chart components (see [[Reports]])
- `connector/` · `customer/` · `dashboard/` · `location/` · `member/` · `responses/` · `review/` · `settings/` · `surveys/` · `workspace/`
- `public/` — `branded-layout.tsx` and inner widgets for [[Public-Pages]]
- `ui/` — shadcn/ui base components

## State
- `src/stores/` — Zustand. Auth store persisted to `localStorage` key `rectangled-auth`
- React Query via tRPC — `src/lib/trpc.ts`

## Related
- [[apps/api]] · [[tRPC-Pattern]] · [[Public-Pages]] · [[Mobile-First-Design]]
