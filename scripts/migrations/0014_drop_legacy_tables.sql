-- Phase 5 — drop legacy journeys + truforms tables.
--
-- Prerequisites:
--   * Phase 3 backfilled every legacy row into surveys + survey_responses
--     with legacy_*_id columns preserved (verified Apr 30 2026: 10 quick +
--     5 deep surveys, 224 + 151 = 375 survey_responses).
--   * Phase 4 (migration 0013) installed BEFORE INSERT/UPDATE triggers and
--     service-layer guards; verify-legacy-frozen.mjs confirms no new rows
--     have been written since cutover.
--   * Phase 3 Stage E renderer compat shim was extended in this commit
--     with getPublicLegacyJourney / getPublicLegacyTruform so the legacy
--     URL renderers no longer read from the dropped tables.
--
-- This migration is irreversible. The data lives on under
--   surveys.legacy_journey_id  → row that was journeys.id
--   surveys.legacy_truform_id  → row that was truforms.id
--   survey_responses.legacy_journey_response_id
--   survey_responses.legacy_truform_response_id
-- so cross-reference back to the old data is preserved.
--
-- Approach for dependent tables: drop only the FOREIGN KEY constraints
-- pointing at the legacy tables. The legacy id columns themselves stay
-- (they hold UUIDs that won't resolve to anything once the parent rows
-- are gone, but cross-referencing happens via legacy_*_id columns on
-- survey_responses now). A future cleanup migration can rename / migrate
-- those columns to point at survey_responses; that's an analytics
-- decision, not a Phase 5 blocker.

-- 1. Drop FK constraints from dependent tables to legacy tables.
ALTER TABLE nev_responses
  DROP CONSTRAINT IF EXISTS nev_responses_truform_response_id_truform_responses_id_fk,
  DROP CONSTRAINT IF EXISTS nev_responses_journey_response_id_journey_responses_id_fk;

ALTER TABLE cli_responses
  DROP CONSTRAINT IF EXISTS cli_responses_truform_response_id_truform_responses_id_fk,
  DROP CONSTRAINT IF EXISTS cli_responses_journey_response_id_journey_responses_id_fk;

ALTER TABLE coupon_instances
  DROP CONSTRAINT IF EXISTS coupon_instances_journey_response_id_journey_responses_id_fk;

ALTER TABLE automation_queue
  DROP CONSTRAINT IF EXISTS automation_queue_journey_response_id_journey_responses_id_fk;

ALTER TABLE automation_rules
  DROP CONSTRAINT IF EXISTS automation_rules_journey_id_journeys_id_fk;

-- 2. Drop the Phase 4 triggers + the function that drove them.
DROP TRIGGER IF EXISTS legacy_frozen_journeys ON journeys;
DROP TRIGGER IF EXISTS legacy_frozen_truforms ON truforms;
DROP TRIGGER IF EXISTS legacy_frozen_journey_responses ON journey_responses;
DROP TRIGGER IF EXISTS legacy_frozen_truform_responses ON truform_responses;
DROP FUNCTION IF EXISTS raise_legacy_table_frozen();

-- 3. Drop the tables. Order matters: response tables first (they FK the
--    parent tables), then journey_screens (FKs journeys), then parents.
DROP TABLE IF EXISTS truform_responses;
DROP TABLE IF EXISTS journey_responses;
DROP TABLE IF EXISTS journey_screens;
DROP TABLE IF EXISTS truforms;
DROP TABLE IF EXISTS journeys;

-- 4. Drop the enums that only the legacy tables used.
--    screen_type was used only by journey_screens.screen_type.
--    truform_type / truform_status were used only by truforms.
DROP TYPE IF EXISTS screen_type;
DROP TYPE IF EXISTS truform_type;
DROP TYPE IF EXISTS truform_status;

-- Note: there is no journey_status enum to drop — the legacy journeys
-- table used isActive (boolean) + archivedAt (timestamp) rather than an
-- enum.
