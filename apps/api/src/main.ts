import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'

/**
 * Inline schema-ensure for the qr_codes table.
 *
 * Migration 0022_qr_codes_management.sql is supposed to apply on
 * container start via the Dockerfile CMD (`node scripts/migrate.mjs
 * && node apps/api/dist/main.js`). On the live deploy it didn't —
 * either the scripts/ dir isn't being COPY'd as expected, or migrate.mjs
 * is failing silently. The `qr.list` endpoint comes back with
 * "relation \"qr_codes\" does not exist" and the dashboard QR page is
 * permanently empty.
 *
 * This function runs at API bootstrap (every boot, idempotent) and
 * creates the qr_codes table + enums + indexes directly. CREATE TABLE
 * IF NOT EXISTS + DO $$ guards make it safe to re-run.
 *
 * Belongs in a proper migration runner long-term, but inline-here is
 * the lowest-risk path to unblock the QR feature without depending on
 * Dockerfile / scripts propagation.
 */
async function ensureQrCodesSchema() {
  if (!process.env.DATABASE_URL) {
    console.warn('[bootstrap] DATABASE_URL not set; skipping qr_codes schema ensure')
    return
  }
  const postgres = (await import('postgres')).default
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  })
  try {
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_target_type') THEN
          CREATE TYPE qr_target_type AS ENUM ('journey', 'form');
        END IF;
      END $$;
    `)
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_status') THEN
          CREATE TYPE qr_status AS ENUM ('active', 'archived');
        END IF;
      END $$;
    `)
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
        target_type qr_target_type NOT NULL,
        target_id UUID NOT NULL,
        label VARCHAR(255),
        short_code VARCHAR(32) NOT NULL UNIQUE,
        destination_url TEXT NOT NULL,
        click_count INTEGER NOT NULL DEFAULT 0,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        status qr_status NOT NULL DEFAULT 'active',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_qr_codes_workspace ON qr_codes (workspace_id);`,
    )
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_qr_codes_target ON qr_codes (target_type, target_id);`,
    )
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_qr_codes_short_code ON qr_codes (short_code);`,
    )
    console.log('[bootstrap] qr_codes schema ensured ✓')
  } catch (err: any) {
    console.error(
      '[bootstrap] failed to ensure qr_codes schema:',
      err?.message ?? err,
    )
    // Don't crash the API on schema-ensure failure — the qr.* endpoints
    // will surface a clear error to the client if the table truly doesn't
    // exist, and the rest of the platform stays up.
  } finally {
    await sql.end()
  }
}

async function bootstrap() {
  // Ensure prod schema is in place BEFORE the app is reachable.
  await ensureQrCodesSchema()

  const app = await NestFactory.create(AppModule)

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }))

  // CORS
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ]
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://127.0.0.1:3000', 'http://localhost:3000')
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })

  app.setGlobalPrefix('api', {
    exclude: ['health', 'trpc', 'trpc/(.*)'],
  })

  const port = process.env.API_PORT || 3001
  await app.listen(port)
  console.log(`🚀 OptimizerV6 API running on http://localhost:${port}`)
  console.log(`   Health: http://localhost:${port}/health`)
  console.log(`   tRPC:   http://localhost:${port}/trpc`)
}

bootstrap()
