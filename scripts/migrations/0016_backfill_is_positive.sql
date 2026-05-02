-- Hotfix PRD §6 — backfill survey_responses.is_positive
--
-- The Phase 3 backfill script (scripts/backfill-surveys.mjs) copied
-- metric_shown + metric_score from journey_responses but did not compute
-- is_positive. Existing rows from that backfill have is_positive = NULL
-- even when the metric data is sufficient to derive it.
--
-- This migration fills in is_positive for any row where:
--   * metric_shown is set
--   * metric_score is set
--   * is_positive is currently NULL
--
-- Thresholds match METRIC_DEFAULT_THRESHOLDS in
-- packages/shared/src/constants/journey-metrics.ts:
--   csat: ≥ 4 (higher is better)
--   nps:  ≥ 9
--   ces:  ≤ 3 (INVERTED — lower effort = better)
--   nev:  ≥ 0
--   cli:  ≥ 5
--
-- Idempotent: re-running this migration only touches rows where
-- is_positive is still NULL, so subsequent runs are no-ops.

UPDATE survey_responses
SET is_positive = CASE
  WHEN metric_shown = 'csat' THEN metric_score >= 4
  WHEN metric_shown = 'nps'  THEN metric_score >= 9
  WHEN metric_shown = 'ces'  THEN metric_score <= 3
  WHEN metric_shown = 'nev'  THEN metric_score >= 0
  WHEN metric_shown = 'cli'  THEN metric_score >= 5
  ELSE NULL
END
WHERE is_positive IS NULL
  AND metric_shown IS NOT NULL
  AND metric_score IS NOT NULL;
