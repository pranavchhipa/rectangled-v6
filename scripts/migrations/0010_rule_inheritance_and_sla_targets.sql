-- Phase 2 Stage A — rule inheritance + per-location SLA targets.
--
-- Pure-additive: new columns default to existing behaviour (scope='workspace'),
-- new FKs are nullable, and the new location_sla_targets table is empty until
-- owners populate it.
--
-- After this migration, the rule engine continues to behave exactly as today
-- because every existing row has scope='workspace' and the workspace_id link
-- it always had. Stage B updates the engine to resolve scope precedence.

-- ================================================================
-- automation_rules — scope columns
-- ================================================================

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS overrides_rule_id UUID;

-- Self-FK for overrides (separate ALTER so it works even if the column existed).
DO $$ BEGIN
  ALTER TABLE automation_rules
    ADD CONSTRAINT automation_rules_overrides_fkey
    FOREIGN KEY (overrides_rule_id) REFERENCES automation_rules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  -- already created
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_rules_scope_org
  ON automation_rules(organization_id) WHERE scope = 'organization';
CREATE INDEX IF NOT EXISTS idx_automation_rules_scope_loc
  ON automation_rules(location_id) WHERE scope = 'location';

COMMENT ON COLUMN automation_rules.scope IS
  'One of (organization | workspace | location). Phase 2 — engine resolves precedence: location > workspace > organization.';
COMMENT ON COLUMN automation_rules.overrides_rule_id IS
  'Informational link from a location override back to the workspace rule it overrides. Engine ignores this and uses scope precedence; the UI uses it to render the inheritance chain.';

-- ================================================================
-- escalation_rules — same scope columns
-- ================================================================

ALTER TABLE escalation_rules
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS overrides_rule_id UUID;

DO $$ BEGIN
  ALTER TABLE escalation_rules
    ADD CONSTRAINT escalation_rules_overrides_fkey
    FOREIGN KEY (overrides_rule_id) REFERENCES escalation_rules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_escalation_rules_scope_org
  ON escalation_rules(organization_id) WHERE scope = 'organization';
CREATE INDEX IF NOT EXISTS idx_escalation_rules_scope_loc
  ON escalation_rules(location_id) WHERE scope = 'location';

-- ================================================================
-- location_sla_targets — per-location aspirational metrics
-- ================================================================

CREATE TABLE IF NOT EXISTS location_sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  review_response_sla_minutes INTEGER,
  escalation_resolve_sla_minutes INTEGER,
  journey_response_target_per_week INTEGER,
  nps_target_score INTEGER,
  csat_target_percent INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE location_sla_targets IS
  'Phase 2 — per-location aspirational targets. Used by the chain dashboard to color leaderboard cells and surface "behind target" callouts. Not enforcement — actual SLA breaches still come from automation_rules.slaMinutes.';
