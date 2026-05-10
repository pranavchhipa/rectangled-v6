---
type: ops
aliases: [Local Dev, Dev Setup]
---

# Local Dev

## Quick start
```bash
docker compose up -d                      # Postgres 16 + Redis 7
npm run build --workspace=packages/db
npm run build --workspace=packages/shared
npm run dev --workspace=apps/api          # NestJS on :3001
npm run dev --workspace=apps/web          # Next.js on :3000
```

## Demo login
`test@example.com` / `password123` → preloaded with everything in [[Seed-Data]].

## DB push (dev only — no migrations)
```bash
cd packages/db
DATABASE_URL="postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6" npx drizzle-kit push
```
**`drizzle-kit push` needs `DATABASE_URL` env var explicitly set** — it doesn't read `.env` files automatically.

For a less raw entry point, the root has guarded scripts:
- `npm run db:push` (uses `scripts/db-push-guard.mjs`)
- `npm run db:studio` (Drizzle Studio)
- `npm run db:migrate`, `db:migrate:status`, `db:migrate:dry-run`

## Env
Copy `.env.example` → `.env` and fill keys. The local `_env` file at repo root is one example (gitignored). Required envs are listed in `CLAUDE.md`.

## Split terminals (when iterating fast)
```bash
docker compose up -d
npm run dev --workspace=packages/db        # if changing schema
npm run dev --workspace=packages/shared    # if changing validators
npm run dev --workspace=apps/api           # NestJS hot reload (slow on Win — see [[Known-Issues]])
npm run dev --workspace=apps/web           # Next.js hot reload
```

## Connects to
- [[Build-and-Verify]] — pre-push checklist
- [[Seed-Data]] — what's loaded for `test@example.com`
- [[Known-Issues]]
