-- Hotfix PRD §2 — flip quick+intelligent surveys to template='adaptive'.
--
-- Pre-flight (already done in migration 0018):
--   * 'adaptive' enum value exists
--   * AdaptiveEngineService is deployed (commit logs the engine class)
--   * SurveyEngineService delegates to AdaptiveEngineService when
--     template = 'adaptive'
--
-- After this migration the 12 surveys' /j/{slug} URLs route through
-- AdaptiveEngineService instead of the step engine. Customer-facing
-- behaviour is observably identical (the step graph implements the
-- same v2 flow); only the implementation switches.
--
-- Idempotent: subsequent runs only flip rows still in the source state.
--
-- Rollback recipe: see docs/HOTFIX_§2_ROLLBACK.md
--
-- Safety filter: legacy_journey_id IS NOT NULL ensures we only touch
-- the 12 surveys that came from the Phase 3 backfill (i.e., are real
-- migrated v1 journeys). Any new quick+intelligent surveys created
-- after the merger via survey.create stay on the step engine until
-- the owner explicitly flips them through the new UI.

UPDATE surveys
SET template = 'adaptive'
WHERE template = 'quick'
  AND mode = 'intelligent'
  AND legacy_journey_id IS NOT NULL;

-- ─── Cleanup the corrupted "Reviews" survey settings ───────────────
--
-- Phase 3 backfill spread a stringified JSON into the settings object
-- character-by-character on one row, leaving 70 numeric keys
-- (settings[0..69] holding individual chars). The named keys are
-- intact alongside the garbage; this strips the noise.
--
-- Idempotent: targets only rows that still have settings ? '0'.

UPDATE surveys
SET settings = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(settings)
  WHERE key !~ '^[0-9]+$'
)
WHERE slug = 'j-4855d6a7-e'
  AND settings ? '0';
