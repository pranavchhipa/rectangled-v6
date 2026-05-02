-- Hotfix PRD §6 — extend is_positive backfill to legacy data shapes.
--
-- Migration 0016 covered v2 adaptive responses (metric_shown + metric_score
-- columns set). That left 371 / 375 rows still NULL because they predate
-- the v2 adaptive shape:
--
--   * 220 old-shape journey responses store the score as
--     response_data->>'rating' (pre-v2 5-star CSAT; no metric_shown column).
--   * 151 truform responses store the score in the dedicated `score` column.
--     The metric type lives on the parent survey's settings.type
--     (nps / csat / ces / custom).
--
-- We can backfill is_positive for both shapes:
--
--   * Old-shape journey: treat rating as CSAT 1-5. Threshold: rating >= 4.
--   * Truform: read the parent survey's settings.type, then apply the
--     matching threshold (csat ≥ 4, nps ≥ 9, ces ≤ 3 inverted, custom keeps NULL).
--
-- Idempotent via WHERE is_positive IS NULL.

-- ─── Old-shape journey responses (treat rating as CSAT) ────────────────
UPDATE survey_responses
SET is_positive = (response_data->>'rating')::int >= 4
WHERE is_positive IS NULL
  AND legacy_journey_response_id IS NOT NULL
  AND metric_shown IS NULL
  AND response_data ? 'rating'
  AND (response_data->>'rating') ~ '^[0-9]+$'
  AND ((response_data->>'rating')::int) BETWEEN 1 AND 5;

-- ─── Truform responses (look up parent survey's settings.type) ─────────
-- One UPDATE per type. Uses a JOIN against surveys to read settings.type.

UPDATE survey_responses sr
SET is_positive = sr.score >= 4
FROM surveys s
WHERE sr.survey_id = s.id
  AND sr.is_positive IS NULL
  AND sr.legacy_truform_response_id IS NOT NULL
  AND sr.score IS NOT NULL
  AND s.settings->>'type' = 'csat';

UPDATE survey_responses sr
SET is_positive = sr.score >= 9
FROM surveys s
WHERE sr.survey_id = s.id
  AND sr.is_positive IS NULL
  AND sr.legacy_truform_response_id IS NOT NULL
  AND sr.score IS NOT NULL
  AND s.settings->>'type' = 'nps';

-- CES is inverted: lower score = better.
UPDATE survey_responses sr
SET is_positive = sr.score <= 3
FROM surveys s
WHERE sr.survey_id = s.id
  AND sr.is_positive IS NULL
  AND sr.legacy_truform_response_id IS NOT NULL
  AND sr.score IS NOT NULL
  AND s.settings->>'type' = 'ces';

-- 'custom' truforms intentionally not backfilled — no canonical threshold.
