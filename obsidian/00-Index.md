---
type: hub
aliases: [Index, Home, Hub]
---

# 00 · Index — Rectangled.io V6

AI-native ORM (Online Reputation Management) platform for Indian SMBs. Turborepo monorepo: NestJS+tRPC API + Next.js 15 web + Drizzle/Postgres.

## Architecture
- [[Architecture-Overview]]
- [[Tech-Stack]]
- [[Monorepo-Layout]]
- [[Data-Flow]]
- [[tRPC-Pattern]]

## Domains (business modules)

### Identity & access
- [[Auth]] · [[Workspaces]] · [[Members]] · [[Organization]] · [[Onboarding]]

### Locations & customers
- [[Locations]] · [[Customers]] · [[Chain]]

### Reviews & feedback
- [[Reviews]] · [[Listings]] · [[Connectors]] · [[Surveys]] · [[Public-Pages]] · [[QR]]

### AI & content
- [[AI-Response]] · [[AI-Agent]] · [[RAIS]] · [[NEV]] · [[CLI]]

### Customer ops
- [[Coupons]] · [[Escalations]] · [[Automations]] · [[Notifications]] · [[Reports]] · [[Appointments]] · [[Business-Aspects]]

### Comms & money
- [[Email]] · [[WapiSnap]] · [[Billing]]

## Cross-cutting concepts
- [[Branding-Resolution]] · [[Workspace-Scoping]] · [[Membership-RBAC]] · [[White-Label]] · [[Hotfix-Trail]] · [[Mobile-First-Design]]

## Integrations
- [[Google-Business-Profile]] · [[Zomato]] · [[Razorpay]] · [[Resend]] · [[OpenRouter]] · [[WapiSnap-Bridge]] · [[Cloudflare-R2]]

## Ops
- [[Local-Dev]] · [[Build-and-Verify]] · [[Seed-Data]] · [[Known-Issues]]

## Code anchors
- API modules: `apps/api/src/*` (27 modules)
- Web pages: `apps/web/src/app/*` (dashboard routes + public `/j` `/f`). Inbox is the canonical review surface; Journeys the canonical surveys surface (post-refactor `79fa581`).
- DB schema: `packages/db/src/schema/*` (28 schema files)
- Shared: `packages/shared/src/{types,validators,constants}`
- Top-level docs: `CLAUDE.md`, `PHASE_*_PLAN.md`, `docs/`
