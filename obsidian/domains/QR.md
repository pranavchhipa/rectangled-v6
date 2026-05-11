---
type: domain
aliases: [QR, QR Codes, QR Code Management]
---

# QR — QR Code Management System

Persistent registry for every QR code generated within a workspace. Each row pairs a short tracking code with a survey destination + an owner-set label, and records scans against a click counter. The dashboard at `/dashboard/qr` is the canonical surface.

## Surface
- API: `apps/api/src/qr/qr.service.ts` (CRUD + click recording), `qr.router.ts`
- DB: `packages/db/src/schema/qr-codes.ts` — `qr_codes` table with `qr_target_type` + `qr_status` enums
- Web (dashboard): `apps/web/src/app/dashboard/qr/page.tsx` — list + filters + create dialog + download menu
- Web (scan handler): `apps/web/src/app/q/[shortCode]/route.ts` — Next.js route that records the click and 302-redirects
- Validators: `packages/shared/src/validators/qr.ts`
- Sidebar: "QR Codes" entry under Customer Journeys (`apps/web/src/components/dashboard/sidebar.tsx`)

## Data model

```
qr_codes
  id            uuid PK
  workspace_id  uuid FK → workspaces (cascade)
  location_id   uuid FK → locations (set null, optional)
  target_type   'journey' | 'form'
  target_id     uuid (surveys.id, no FK so archives don't break click history)
  label         varchar(255), owner-set "purpose" string
  short_code    varchar(32) UNIQUE — 8-char base64url, the trackable slug
  destination_url  text  — cached /j/<slug> or /f/<slug> URL
  click_count   integer DEFAULT 0 — denormalized counter
  settings      jsonb DEFAULT {} — future styling overrides
  status        'active' | 'archived'
  created_by    uuid FK → users (set null)
  created_at / updated_at
```

## Scan flow

```
Customer scans QR
        │
        ▼
GET {APP_URL}/q/<shortCode>
        │
        ▼ (Next.js route handler)
apps/web/src/app/q/[shortCode]/route.ts
        │
        ▼ (server fetch, no-cache)
POST {API_URL}/trpc/qr.recordClick?batch=1
  body: {"0":{"shortCode":"..."}}
        │
        ▼
QrService.recordClickAndResolve
  - UPDATE qr_codes SET click_count = click_count + 1 (if status='active')
  - returns { destinationUrl, status }
        │
        ▼
NextResponse.redirect(destinationUrl, 302)
        │
        ▼
Customer lands on /j/<slug> or /f/<slug>
```

## tRPC routes
- `trpc.qr.list({ workspaceId, status?, locationId? })` — joined to surveys for target name/slug
- `trpc.qr.create({ workspaceId, targetType, targetId, label?, locationId? })` — picks short code, caches destination, returns the row + trackingUrl. Retries up to 5× on unique-constraint collision.
- `trpc.qr.update({ id, label?, status? })`
- `trpc.qr.archive({ id })`
- `trpc.qr.download({ id, format: 'png' | 'svg', size: 100-2000 })` — regenerates the QR encoding the **tracking URL** (so the counter always increments)
- `trpc.qr.recordClick({ shortCode })` — public; the scan handler

## Status semantics
- **Active** — counts scans, redirects to destination
- **Archived** — still redirects (so a printed sticker doesn't 404) but the counter is frozen. Prevents an in-the-wild sticker from indefinitely inflating an old campaign's numbers.

## What changed (commit `fae9ea3`)
Before this work, the `qr/` module only generated QR images on demand for the journeys/[id] editor's QR dialog — no persistence, no tracking, no list view. The legacy `generateJourneyQr` / `generateFormQr` / `generateBulkQr` mutations are kept for back-compat with that dialog; new code paths use the registry.

## Auto-backfill (commit `5a092df`)

On every `qr.list` call, the service scans for active surveys in the workspace that don't yet have a `qr_codes` row and creates one default QR per missing survey (label = survey name, default short code, no location override). Idempotent — once a survey has any row, backfill is a no-op for it.

Why: the empty registry was a UX dead-end. Owners with N existing journeys arrived at `/dashboard/qr` expecting to see N QRs, and got the "Create your first QR" CTA instead. Backfill closes that gap without taking away the ability to add ADDITIONAL purpose-labeled QRs for the same survey.

Single bad survey doesn't break the whole list — backfill errors are swallowed + logged.

## DB migration
The new schema requires `scripts/migrations/0022_qr_codes_management.sql` to apply. Two paths in code:
1. **Primary (intended):** Dockerfile.api CMD runs `node scripts/migrate.mjs && node apps/api/dist/main.js` on every container boot. Idempotent via the `_app_migrations` tracking table.
2. **Fallback (commit `d343ba7`):** `apps/api/src/main.ts → ensureQrCodesSchema()` runs the same DDL inline at bootstrap, before `app.listen()`. Uses `CREATE TABLE IF NOT EXISTS` + `DO $$` guards on the enums — safe to re-run.

The fallback was added because the Dockerfile path silently no-op'd on the live deploy (root cause unconfirmed — either `scripts/migrations/` isn't being COPY'd into the runner image or migrate.mjs fails without propagating its exit code). Long-term the migrate runner path should still be debugged — but the inline path means `qr_codes` is guaranteed to exist on every API boot regardless.

## Connects to
- [[Locations]] — optional location scope on each QR
- [[Surveys]] — target (journey or truform)
- [[Public-Pages]] — destination after redirect
- [[Customer-Journeys]] — the QR is the most common entry point for Journey A
- [[Reports]] — future home for QR-scan analytics dashboards
- [[Hotfix-Trail]]
