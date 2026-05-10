---
type: architecture
---

# Tech Stack

## Frontend ([[apps/web]])
- **Next.js 15** — App Router (`apps/web/src/app/`)
- **TailwindCSS v4** + **shadcn/ui** components
- **Zustand** — auth store, persisted to `localStorage` key `rectangled-auth`
- **React Query via tRPC** — `apps/web/src/lib/trpc.ts`

## Backend ([[apps/api]])
- **NestJS** — modular DI container (`apps/api/src/app.module.ts`)
- **tRPC** — typed RPC layer (see [[tRPC-Pattern]]); REST only for webhooks
- **Drizzle ORM** — query layer over Postgres
- **PostgreSQL 16** + **Redis 7** (via `docker-compose.yml`)

## Shared
- **packages/shared** — Zod validators, types, constants. `export *` from `validators/index.ts`. **Rebuild this before API restart** when validators change.
- **packages/db** — Drizzle schemas + relations + enums. Drizzle-kit `push` (not migrations) for dev.

## External services (see [[Integrations]])
- **AI:** [[OpenRouter]] (OpenAI SDK wrapper) → `openai/gpt-4o-mini` default
- **Payments:** [[Razorpay]] (test mode) — lazy-init in `billing.service.ts`
- **Email:** [[Resend]]
- **WhatsApp:** [[WapiSnap-Bridge]] (HMAC-SHA256 signed HTTP)
- **Reviews:** [[Google-Business-Profile]], [[Zomato]] — via [[Connectors]] adapters
- **Storage:** [[Cloudflare-R2]] (pending — see open items in `CLAUDE.md`)

## Deploy
- **DigitalOcean App Platform** — `api` + `web` services. Push to `origin/main` → auto-redeploy 2-5 min. No staging.
- See [[Build-and-Verify]] for local checks before push.

## Tooling
- **Turborepo 2** — `turbo dev`, `turbo build`
- **Vitest** — 111 tests, all passing on green main
- **TypeScript 5.7** strict
- **Prettier 3.4** + ESLint 9
