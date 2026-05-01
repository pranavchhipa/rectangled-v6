#!/usr/bin/env node
/**
 * Wrapper for `drizzle-kit push`. Refuses to run in production.
 *
 * Phase 0 spec rule: db:push is forbidden in production due to a
 * drizzle-kit introspection bug that wants to drop ~50 NOT NULL
 * constraints. Use scripts/migrate.mjs (and tracked migrations) instead.
 *
 * Local dev: db:push is fine. NODE_ENV=development (default) or unset
 * passes through.
 */
import { spawnSync } from 'node:child_process'

const env = process.env.NODE_ENV ?? 'development'
if (env === 'production') {
  console.error('')
  console.error('  ╔═══════════════════════════════════════════════════════╗')
  console.error('  ║  drizzle-kit push is FORBIDDEN in production.         ║')
  console.error('  ║                                                       ║')
  console.error('  ║  It drops ~50 NOT NULL constraints due to a known     ║')
  console.error('  ║  introspection bug. Data integrity will break.        ║')
  console.error('  ║                                                       ║')
  console.error('  ║  Use:  npm run db:migrate                             ║')
  console.error('  ║  Docs: docs/MIGRATIONS.md                             ║')
  console.error('  ╚═══════════════════════════════════════════════════════╝')
  console.error('')
  process.exit(1)
}

console.log(`[db:push] running in ${env} environment.`)
const result = spawnSync('npx', ['drizzle-kit', 'push'], {
  stdio: 'inherit',
  cwd: 'packages/db',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 0)
