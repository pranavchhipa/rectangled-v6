-- Phase 1 Stage A — Organizations layer schema (additive only).
--
-- This migration is purely additive: new types, new tables, new columns
-- on existing tables. It does NOT make workspaces.organization_id NOT NULL
-- yet — that happens in 0009 after the backfill in 0008. Keeping it
-- additive means deploys can land this migration safely while existing
-- workspaces are still organisation-less.

-- ================================================================
-- 1. New enum types
-- ================================================================

DO $$ BEGIN
  CREATE TYPE organization_type AS ENUM ('direct', 'multi_location', 'agency');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE organization_role AS ENUM ('org_owner', 'org_admin', 'org_manager', 'org_member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ================================================================
-- 2. organizations
-- ================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type organization_type NOT NULL DEFAULT 'direct',
  owner_user_id UUID NOT NULL REFERENCES users(id),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  white_label JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS
  'Phase 1 — top-level tenant. Workspaces become children. type decides UX (direct/multi_location/agency).';

-- ================================================================
-- 3. organization_members
-- ================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role organization_role NOT NULL,
  workspace_ids UUID[],
  accepted_at TIMESTAMP,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_organization_members_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user
  ON organization_members(user_id);

COMMENT ON COLUMN organization_members.workspace_ids IS
  'NULL = full access to all workspaces in the org. Non-null = restricted to listed IDs (used for org_manager/org_member with explicit scope or agency client owners).';

-- ================================================================
-- 4. workspaces — add organization_id (nullable, will tighten in 0009)
--    + client_metadata
-- ================================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN workspaces.organization_id IS
  'Phase 1 — every workspace belongs to an organization. NULL only during the migration window (0007 → 0009).';
COMMENT ON COLUMN workspaces.client_metadata IS
  'Agency-mode metadata about the client this workspace represents. Empty {} for direct/multi_location orgs.';

-- ================================================================
-- 5. onboarding_state — branching flow
-- ================================================================

ALTER TABLE onboarding_state
  ADD COLUMN IF NOT EXISTS flow VARCHAR(20) NOT NULL DEFAULT 'direct';

COMMENT ON COLUMN onboarding_state.flow IS
  'Phase 1 — onboarding flow per organization type: direct | multi_location | agency.';
