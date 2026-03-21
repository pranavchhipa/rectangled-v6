# OptimizerV6 — rectangled.io

## What is this project?
AI-native Online Reputation Management (ORM) platform for Indian SMBs. Built as a Turborepo monorepo.

## Quick Start
```bash
docker compose up -d          # PostgreSQL + Redis
npm run build --workspace=packages/db
npm run build --workspace=packages/shared
npm run dev --workspace=apps/api   # NestJS API on :3001
npm run dev --workspace=apps/web   # Next.js on :3000
```

**Demo Login:** `test@example.com` / `password123`
**DB Schema Push:** `cd packages/db && DATABASE_URL="postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6" npx drizzle-kit push`

## Architecture

### Monorepo Structure
```
apps/
  api/          → NestJS + tRPC (port 3001)
  web/          → Next.js 15 + shadcn/ui (port 3000)
packages/
  db/           → Drizzle ORM schemas, PostgreSQL
  shared/       → Zod validators, constants, types
```

### Tech Stack
- **Frontend:** Next.js 15 (App Router), TailwindCSS v4, shadcn/ui, Zustand (auth store), React Query via tRPC
- **Backend:** NestJS with tRPC routers (not REST), Drizzle ORM, PostgreSQL 16, Redis 7
- **AI:** OpenRouter (OpenAI SDK wrapper) → GPT-4o-mini default
- **Payments:** Razorpay (test mode)
- **Email:** Resend
- **WhatsApp:** WapiSnap Bridge (HMAC-SHA256 signed HTTP)

### Key Patterns
1. **tRPC dual-router:** Static router for type export (`null as any` services), runtime router in `onModuleInit` with real DI services
2. **Auth:** JWT 30-day access token, stored in Zustand → localStorage key `rectangled-auth`
3. **All queries are workspace-scoped:** `enabled: !!currentWorkspaceId`
4. **Every service has `requireMembership()`** for permission checks
5. **Lazy initialization** for external clients (Razorpay, OpenRouter) to avoid module-load crashes
6. **Shared package exports via `export *`** from validators — rebuild shared after adding new validators

### Database
- 28 schema files in `packages/db/src/schema/`
- All enums in `enums.ts`
- Relations in `relations.ts`
- Export everything from `index.ts`
- **Drizzle-kit push** (not migrations) for dev: needs `DATABASE_URL` env var explicitly

### API Modules (27 feature modules)
auth, workspace, location, member, connector (GBP + Zomato adapters), review, listing, customer, onboarding, business-aspect, journey, truform, billing, ai-response, coupon, nev (emotion scoring), cli (loyalty index), qr, automation, cx-routing (escalations), notification, report, email, wapisnap, rais (AI social content), trpc (aggregator), database

### Frontend Pages (28 dashboard pages)
login, dashboard, inbox, analytics, listings, settings, journeys, journeys/[id], truforms, truforms/[id], coupons, reports, reports/[id], escalations, escalations/rules, billing, automations, rais (AI Studio), customers, connectors, locations, members, onboarding, reviews, admin, admin/billing, listings/[id], listings/posts

### Analytics Components (13 chart components)
health-score-card, rating-distribution-chart, review-velocity-chart, sentiment-chart, platform-comparison-chart, rating-trend-chart, response-rate-card, top-themes-chart, source-donut-chart, aspect-performance-chart, sentiment-trend-chart, nev-emotion-wheel, cli-segment-chart

## Environment Variables (.env at project root)
```
DATABASE_URL=postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-do-not-use-in-production-12345
JWT_EXPIRY=30d
API_PORT=3001
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_API_KEY=<your-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini
GOOGLE_CLIENT_ID=<your-id>
GOOGLE_CLIENT_SECRET=<your-secret>
GOOGLE_REDIRECT_URL=http://localhost:3050/gbp/auth
RESEND_API_KEY=<your-key>
EMAIL_FROM=reviews@exprectangled.com
WAPISNAP_BRIDGE_URL=http://localhost:3050/bridge
WAPISNAP_BRIDGE_SECRET=
RAZORPAY_KEY_ID=<your-test-key>
RAZORPAY_KEY_SECRET=<your-secret>
RAZORPAY_WEBHOOK_SECRET=
```

## Known Issues / Gotchas
1. **Windows NestJS compilation:** Takes 3-5 min in watch mode. Be patient.
2. **Razorpay lazy init:** `getRazorpay()` function in billing.service.ts — crashes if loaded at module level without env vars
3. **Port conflicts:** Kill orphaned processes: `powershell -Command "Get-NetTCPConnection -LocalPort 3000,3001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`
4. **DB identifier truncation:** PostgreSQL warns about long FK names — cosmetic only
5. **Shared package rebuild:** After adding validators/constants, run `npm run build --workspace=packages/shared` before API restart
6. **tRPC route path warning:** `trpc/(.*)` path shows NestJS deprecation warning — works fine, cosmetic
7. **Optional mutations on frontend:** Some pages use `trpc.xxx?.useMutation?.()` pattern for graceful degradation

## Seed Data
Database has been seeded with comprehensive demo data for `test@example.com`:
- 100+ customers with realistic Indian names/phones
- 500+ Google & Zomato reviews (1-5 stars, real-sounding text)
- 200+ AI-generated review responses (draft/approved/posted)
- 50+ escalations with SLA tracking
- 20+ coupon templates + 100+ issued coupons
- Journey responses, TruForm responses
- NEV emotion data, CLI loyalty scores
- Notifications, automation rules, reports
- 5 team members with different roles
- 3 locations (Mumbai, Pune, Bangalore)
- Billing subscription (Pro plan)

## PRD Reference
Original PRD: `OptimizerV6_Blueprint_V3_1.docx` — covers all features in detail.
Integration proposal: `INTEGRATION_PROPOSAL_V6_BRIDGE.md` for WapiSnap architecture.
