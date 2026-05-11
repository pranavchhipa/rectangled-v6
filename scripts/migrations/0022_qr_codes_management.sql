-- QR Code Management System (commit fae9ea3).
--
-- New persistent registry for every QR code generated in a workspace.
-- Pairs a short tracking code with a survey destination + records clicks.
-- Owner dashboard at /dashboard/qr; public scan handler at /q/[shortCode].
--
-- Schema additions:
--   - enum  qr_target_type  ('journey' | 'form')
--   - enum  qr_status       ('active' | 'archived')
--   - table qr_codes         (the registry)
--   - 3 indexes on qr_codes (workspace, target, short_code)
--
-- Idempotent: enums and table use IF NOT EXISTS / DO NOTHING patterns
-- so re-running is a no-op. Indexes use IF NOT EXISTS.
--
-- FKs:
--   workspace_id → workspaces.id  ON DELETE CASCADE  (a workspace's QRs die with it)
--   location_id  → locations.id   ON DELETE SET NULL (decoupling on location delete)
--   created_by   → users.id       ON DELETE SET NULL (preserve QR if creator leaves)
--
-- target_id is NOT an FK to surveys.id — we want the row to survive a
-- survey archive so click history doesn't disappear.

-- ─── Enums ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_target_type') THEN
    CREATE TYPE qr_target_type AS ENUM ('journey', 'form');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_status') THEN
    CREATE TYPE qr_status AS ENUM ('active', 'archived');
  END IF;
END
$$;

-- ─── Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qr_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  location_id      UUID REFERENCES locations(id) ON DELETE SET NULL,

  target_type      qr_target_type NOT NULL,
  target_id        UUID NOT NULL,

  label            VARCHAR(255),
  short_code       VARCHAR(32) NOT NULL UNIQUE,
  destination_url  TEXT NOT NULL,
  click_count      INTEGER NOT NULL DEFAULT 0,
  settings         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           qr_status NOT NULL DEFAULT 'active',

  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_qr_codes_workspace
  ON qr_codes (workspace_id);

CREATE INDEX IF NOT EXISTS idx_qr_codes_target
  ON qr_codes (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_qr_codes_short_code
  ON qr_codes (short_code);
