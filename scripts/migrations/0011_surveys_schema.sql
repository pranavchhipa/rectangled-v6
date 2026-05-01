-- Phase 3 Stage A — unified surveys schema.
--
-- Pure-additive: new enums, three new tables, no changes to existing
-- journeys / truforms / responses tables. Stage B fills surveys with
-- copies of existing journey/truform rows; the dual-write era starts
-- when the engine ships in Stage C/D.
--
-- legacy_journey_id and legacy_truform_id on surveys (and the equivalent
-- fields on survey_responses) preserve the link back to the source row
-- so we can cross-reference counts, roll back per-row if needed, and
-- detect rows that were created post-migration in either system.

-- ================================================================
-- 1. Enums
-- ================================================================

DO $$ BEGIN
  CREATE TYPE survey_template AS ENUM ('quick', 'deep');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE survey_mode AS ENUM ('intelligent', 'builder');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE survey_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ================================================================
-- 2. surveys table
-- ================================================================

CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,

  template survey_template NOT NULL,
  mode survey_mode NOT NULL DEFAULT 'intelligent',
  status survey_status NOT NULL DEFAULT 'draft',

  -- For 'quick' template: { enabledMetrics, thresholds, enableCoupon, reviewPlatform }
  -- For 'deep' template:  { type: 'nps'|'csat'|'ces'|'custom', branding, thankYou, ... }
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Step graph for the engine (8 step types, see packages/shared/src/types/survey-steps.ts)
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Migration tracking — populated when the row is a copy of a legacy journey or truform.
  legacy_journey_id UUID,
  legacy_truform_id UUID,

  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_workspace ON surveys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_surveys_location ON surveys(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_organization ON surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_legacy_journey ON surveys(legacy_journey_id) WHERE legacy_journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_legacy_truform ON surveys(legacy_truform_id) WHERE legacy_truform_id IS NOT NULL;

COMMENT ON TABLE surveys IS
  'Phase 3 — unified surveys (subsumes journeys + truforms). template=quick is the legacy Journey; template=deep is the legacy TruForm.';

-- ================================================================
-- 3. survey_responses table
-- ================================================================

CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  session_id VARCHAR(100) NOT NULL,
  response_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Quick-template hot-path columns (cheap analytics queries).
  metric_shown VARCHAR(20),
  metric_score INTEGER,
  is_positive BOOLEAN,

  -- Deep-template hot-path columns.
  score INTEGER,
  answers JSONB,

  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  abandoned_at TIMESTAMP,

  metadata JSONB DEFAULT '{}'::jsonb,

  legacy_journey_response_id UUID,
  legacy_truform_response_id UUID,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_workspace ON survey_responses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_location ON survey_responses(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_customer ON survey_responses(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_legacy_jr ON survey_responses(legacy_journey_response_id) WHERE legacy_journey_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_legacy_tr ON survey_responses(legacy_truform_response_id) WHERE legacy_truform_response_id IS NOT NULL;

-- ================================================================
-- 4. survey_starts table — abandonment tracking
-- ================================================================

CREATE TABLE IF NOT EXISTS survey_starts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  session_id VARCHAR(100) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT uniq_survey_starts_session UNIQUE (survey_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_starts_survey ON survey_starts(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_starts_abandoned
  ON survey_starts(survey_id, started_at)
  WHERE completed_at IS NULL;

COMMENT ON TABLE survey_starts IS
  'Phase 3 — first-visit tracking. completed_at IS NULL after a configurable threshold = abandoned. Closes the TruForms abandonment-tracking gap that today only journeys have.';
