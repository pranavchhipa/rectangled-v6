-- Phase 4 Stage A — freeze legacy tables.
--
-- After Phase 3 every existing journey/truform was backfilled into
-- `surveys` (with legacy_*_id preserved) and the new survey engine + CRUD
-- service is the only sanctioned write path. This migration installs a
-- BEFORE INSERT/UPDATE trigger on each legacy table so even direct SQL
-- (or some forgotten code path) cannot create new rows. Existing rows
-- stay readable for analytics until Phase 5 (T+1mo) drops the tables.
--
-- DELETE is intentionally still allowed:
--   - Phase 5 needs it to drop rows during table teardown.
--   - Cascading deletes from workspaces/locations should keep working.
--
-- Service-layer guards in journey.service.ts / truform.service.ts throw
-- a friendlier TRPCError(GONE) before queries reach the trigger.

CREATE OR REPLACE FUNCTION raise_legacy_table_frozen() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = format(
      'Legacy table %I is frozen as of Phase 4. Use surveys.* / survey_responses.* instead. See docs/PHASE_4_CHANGES.md.',
      TG_TABLE_NAME
    );
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legacy_frozen_journeys ON journeys;
CREATE TRIGGER legacy_frozen_journeys
  BEFORE INSERT OR UPDATE ON journeys
  FOR EACH ROW EXECUTE FUNCTION raise_legacy_table_frozen();

DROP TRIGGER IF EXISTS legacy_frozen_truforms ON truforms;
CREATE TRIGGER legacy_frozen_truforms
  BEFORE INSERT OR UPDATE ON truforms
  FOR EACH ROW EXECUTE FUNCTION raise_legacy_table_frozen();

DROP TRIGGER IF EXISTS legacy_frozen_journey_responses ON journey_responses;
CREATE TRIGGER legacy_frozen_journey_responses
  BEFORE INSERT OR UPDATE ON journey_responses
  FOR EACH ROW EXECUTE FUNCTION raise_legacy_table_frozen();

DROP TRIGGER IF EXISTS legacy_frozen_truform_responses ON truform_responses;
CREATE TRIGGER legacy_frozen_truform_responses
  BEFORE INSERT OR UPDATE ON truform_responses
  FOR EACH ROW EXECUTE FUNCTION raise_legacy_table_frozen();

-- Note: journey_screens (the metric-question screen storage) is left
-- untouched. Phase 3 backfill READ from it but didn't write; the legacy
-- journey.create flow that wrote to it is being blocked at the service
-- layer, and the screens table will be dropped in Phase 5 along with
-- its parent journeys table.
