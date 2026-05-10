---
type: architecture
---

# Monorepo Layout

```
optimizerv6/
├── apps/
│   ├── api/         → NestJS + tRPC, port 3001        ([[apps/api]])
│   └── web/         → Next.js 15 + shadcn/ui, port 3000 ([[apps/web]])
├── packages/
│   ├── db/          → Drizzle schemas, Postgres
│   └── shared/      → Zod validators, types, constants
├── docs/            → PRD, phase change-logs, design docs
├── scripts/         → migration + db push helpers
├── docker-compose.yml  → Postgres 16 + Redis 7
├── turbo.json       → pipeline definitions
└── tsconfig.base.json
```

## apps/api ([[apps/api]])
27 feature modules + `trpc/` aggregator + `database/` connection module + `common/` (guards, decorators).

Module → folder mapping in `apps/api/src/`:
- Identity: `auth`, `member`, `organization`, `workspace`, `onboarding`
- Locations: `location`, `chain`
- Customers + reviews: `customer`, `review`, `listing`, `connector` (with `connector/adapters/`)
- Surveys: `surveys`, `qr`, `business-aspect`
- AI: `ai-response`, `ai-agent`, `rais`, `nev`, `cli`
- Customer ops: `coupon`, `cx-routing`, `automation`, `notification`, `report`, `appointment`
- Comms + money: `email`, `wapisnap`, `billing`
- Plumbing: `trpc`, `database`, `common`, `internal-jobs`

## apps/web ([[apps/web]])
- `src/app/` — App Router pages (28 dashboard routes + public `/j/[slug]`, `/f/[slug]`, `/auth`, `/book`, `/accept-invite`)
- `src/components/` — domain-grouped (`analytics`, `connector`, `customer`, `dashboard`, `location`, `member`, `public`, `responses`, `review`, `settings`, `surveys`, `ui`, `workspace`)
- `src/lib/` — tRPC client, helpers
- `src/stores/` — Zustand stores (auth)
- `src/providers/`, `src/hooks/`

## packages/db
- `src/schema/` — 28 tables, one file per table or domain group
- `src/schema/enums.ts` — all PG enums
- `src/schema/relations.ts` — Drizzle relation graph
- `src/schema/index.ts` — re-exports everything

## packages/shared
- `src/validators/` — one file per domain (Zod schemas)
- `src/types/` — non-Zod TS types (e.g. [[Branding-Resolution|branding]])
- `src/constants/` — shared lookups (industries, roles, journey-metrics, …)
- `src/index.ts` uses `export *` — see "Rebuild shared" gotcha in [[Known-Issues]]

## Related
- [[Architecture-Overview]] · [[Tech-Stack]] · [[Local-Dev]]
