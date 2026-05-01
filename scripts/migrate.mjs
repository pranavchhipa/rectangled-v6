#!/usr/bin/env node
/**
 * Tracked SQL migration runner.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs --status   # show state
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs --dry-run  # show pending, apply nothing
 *
 * Migration files live in scripts/migrations/, named NNNN_short_description.sql
 * where NNNN is a zero-padded sequence (0001, 0002, ...). Files are applied in
 * lexicographic order. Each migration runs in a transaction; the version is
 * recorded in _app_migrations on success.
 *
 * Idempotent: re-running skips already-applied migrations.
 *
 * Why a custom runner instead of drizzle-kit?
 * - drizzle-kit push wants to drop ~50 NOT NULL constraints due to an
 *   introspection bug — unsafe in production.
 * - drizzle-kit generate requires baseline reconciliation work that's brittle
 *   when the codebase has been pushed-not-tracked for months.
 * - We want SQL files we can review, blame, and roll back individually.
 */
import postgres from 'postgres'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')
const TABLE = '_app_migrations'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL not set. Aborting.')
  process.exit(1)
}

// Production safety: this runner replaces `drizzle-kit push`. We don't gate
// the runner itself on NODE_ENV (that's what we WANT in production) but we
// log loudly so it's clear what's running where.
const env = process.env.NODE_ENV ?? 'development'
const flags = new Set(process.argv.slice(2))
const dryRun = flags.has('--dry-run')
const statusOnly = flags.has('--status')

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} })

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(TABLE)} (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
      applied_by VARCHAR(255),
      checksum VARCHAR(64)
    )
  `
}

async function appliedVersions() {
  const rows = await sql`SELECT version FROM ${sql(TABLE)} ORDER BY version`
  return new Set(rows.map((r) => r.version))
}

function discoverMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) {
    return []
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({
      file,
      version: file.replace(/\.sql$/i, ''),
      path: join(MIGRATIONS_DIR, file),
    }))
}

async function applyOne(migration) {
  const sqlText = readFileSync(migration.path, 'utf8')
  if (!sqlText.trim()) {
    console.log(`[migrate] ${migration.file} is empty, skipping`)
    return
  }

  // Each migration runs in its own transaction.
  await sql.begin(async (tx) => {
    // Use unsafe() so the file can contain multi-statement SQL and DDL.
    await tx.unsafe(sqlText)
    await tx`
      INSERT INTO ${tx(TABLE)} (version, applied_by)
      VALUES (${migration.version}, ${env})
    `
  })
}

async function main() {
  console.log(`[migrate] env=${env} db=${DATABASE_URL.replace(/:[^@]*@/, ':<redacted>@')}`)
  await ensureTable()
  const applied = await appliedVersions()
  const all = discoverMigrations()
  const pending = all.filter((m) => !applied.has(m.version))

  console.log(`[migrate] found ${all.length} migration file(s); ${applied.size} applied; ${pending.length} pending`)

  if (statusOnly) {
    console.log('\nApplied:')
    for (const v of [...applied].sort()) console.log(`  ✓ ${v}`)
    console.log('\nPending:')
    for (const m of pending) console.log(`  · ${m.version}`)
    return
  }

  if (pending.length === 0) {
    console.log('[migrate] nothing to do.')
    return
  }

  if (dryRun) {
    console.log('\n[migrate] DRY RUN — would apply:')
    for (const m of pending) console.log(`  · ${m.version}`)
    return
  }

  for (const m of pending) {
    process.stdout.write(`[migrate] applying ${m.version} ... `)
    try {
      await applyOne(m)
      console.log('✓')
    } catch (err) {
      console.log('✗')
      console.error(err.message ?? err)
      console.error(`[migrate] aborting; ${m.version} did not apply.`)
      process.exit(1)
    }
  }

  console.log(`[migrate] done. ${pending.length} migration(s) applied.`)
}

try {
  await main()
} finally {
  await sql.end()
}
