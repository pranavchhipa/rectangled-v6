-- Phase 3 Stage B — backfill marker.
--
-- The actual backfill (copying journeys → surveys, truforms → surveys,
-- and responses) is done by scripts/backfill-surveys.mjs because the
-- step graph construction lives in TypeScript (packages/shared) and we
-- want the Node helpers to build those graphs rather than re-implementing
-- them in PL/pgSQL.
--
-- This SQL migration only records that the marker exists so future
-- migrations can chain off it. Re-running scripts/backfill-surveys.mjs
-- is idempotent (it skips rows that already have a legacy_*_id match).

SELECT 1; -- noop
