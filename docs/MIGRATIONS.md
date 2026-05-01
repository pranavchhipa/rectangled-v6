# Migration discipline

Phase 0 of the OptimizerV6 master rebuild. Schema changes use **tracked SQL migrations**, applied via a custom runner. `drizzle-kit push` is forbidden in production.

## Why

`drizzle-kit push` against this DB wants to drop ~50 NOT NULL constraints — a known introspection bug. Running it would silently destroy data integrity. We avoid `push` in production entirely.

Tracked migrations also give us:
- A reviewable diff per change (committed SQL files)
- Rollback recipes per change
- A clear history of what was applied where and when (`_app_migrations` table)
- The ability to re-run safely (idempotent runner)

## Layout

```
scripts/
  migrate.mjs              ← runner
  db-push-guard.mjs        ← wrapper that blocks `db:push` in production
  migrations/
    0001_<short_name>.sql
    0002_<short_name>.sql
    ...
```

Each migration file:
- Numbered with a zero-padded sequence (`0001`, `0002`, ...)
- Self-contained SQL (DDL + any data backfill)
- Wrapped with `IF NOT EXISTS` / `IF EXISTS` so re-applying is a no-op (defense in depth — the runner skips applied migrations, but idempotent SQL is still safer)
- Reviewed in code review like any other change

## Day-to-day workflow

### Add a new schema change

1. Edit `packages/db/src/schema/*.ts` (the canonical Drizzle schema definition).
2. Write a SQL migration in `scripts/migrations/NNNN_descriptive_name.sql`.
3. Test locally:
   ```
   DATABASE_URL=<local-db> npm run db:migrate
   ```
4. Commit both the schema edit and the migration in the same commit.
5. Deploy. The deployment runs `npm run db:migrate` against production (or staging first).

### Generate the SQL via Drizzle (optional helper)

If you'd like Drizzle to generate the SQL for you:

```
cd packages/db
DATABASE_URL=<local-db> npx drizzle-kit generate --name <short_name>
```

This writes a SQL file in `packages/db/migrations/` (drizzle's own folder). Copy it into `scripts/migrations/` with the next sequence number, review it carefully — drizzle-kit's introspection sometimes proposes destructive operations — and only then commit.

**Never trust the output blindly.** Always read it. The bug that motivated this discipline is exactly that drizzle-kit proposes wrong things.

### Inspect state

```
npm run db:migrate -- --status   # show applied + pending
npm run db:migrate -- --dry-run  # list pending without applying
```

### Local dev — `db:push` still works

If you want to iterate on schema in local dev without writing a migration:

```
npm run db:push
```

This is gated by `db-push-guard.mjs` and only runs when `NODE_ENV !== 'production'`. Once you're happy with the schema, write the migration before opening a PR.

## Runner internals

`scripts/migrate.mjs`:

1. Connects via `DATABASE_URL`.
2. Creates `_app_migrations(version PK, applied_at, applied_by, checksum)` if absent.
3. Reads `scripts/migrations/*.sql` lexicographically.
4. For each file not yet recorded in `_app_migrations`:
   - Reads the SQL.
   - Opens a transaction.
   - Runs the SQL.
   - Records the version in `_app_migrations`.
   - Commits.
5. On any error, rolls back that file's transaction and aborts the whole run. Earlier successful migrations stay committed.

Re-runs are no-ops. Failed migrations can be retried after fixing the SQL.

## When to roll back

If a migration breaks production:

1. **Stop new traffic to the affected service** (or feature-flag off the new code path).
2. **Apply a corrective migration** — write a new `NNNN+1_revert_<thing>.sql` that undoes the bad change. This is preferred over editing/removing the bad file because the runner relies on append-only history.
3. Don't delete or edit a migration that's already been applied to any environment. Treat applied SQL as immutable.

If the rollback is structural (column drop, table drop), and you're certain no rows reference the artifact, the new migration can do the destructive work safely. Otherwise, write a soft-revert (e.g. flip a feature flag, leave the column).

## Disaster recovery (schema baseline)

If you ever need a complete schema snapshot (e.g. to restore after a catastrophic failure):

```
pg_dump --schema-only --no-owner --no-acl $DATABASE_URL > scripts/baseline-YYYY-MM-DD.sql
```

This is for **disaster recovery only**, not for the migration runner. The runner deals only with the diffs in `scripts/migrations/`.

## What about `packages/db/migrations/`?

That folder is drizzle-kit's default output. We don't use it for the runner. It can stay around as a generation scratch space — or be deleted entirely. The runner only reads `scripts/migrations/`.

If `packages/db/migrations/` already has files in it (from earlier `drizzle-kit generate` runs), don't worry — they're not authoritative. Authority lives in `scripts/migrations/` only.
