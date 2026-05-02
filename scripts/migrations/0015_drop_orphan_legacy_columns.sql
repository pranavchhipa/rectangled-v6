-- Phase 5 follow-up — drop the orphan legacy_*_id columns left behind
-- by 0014.
--
-- Migration 0014 (Phase 5) dropped the journeys / truforms / *_responses
-- tables but left these columns on dependent tables as plain UUIDs (no
-- FK) for "future analytics decision":
--
--   nev_responses.truform_response_id, .journey_response_id
--   cli_responses.truform_response_id, .journey_response_id
--   coupon_instances.journey_response_id
--   automation_queue.journey_response_id
--   automation_rules.journey_id
--   reviews.journey_response_id  (if it exists — see below)
--
-- The columns hold UUIDs that no longer resolve to anything. The forward
-- linkage now lives on survey_responses.legacy_journey_response_id /
-- survey_responses.legacy_truform_response_id (preserved by the Phase 3
-- backfill). Anyone needing to cross-reference can JOIN through there.
--
-- This migration drops the columns to remove dead weight from the schema.

ALTER TABLE nev_responses
  DROP COLUMN IF EXISTS truform_response_id,
  DROP COLUMN IF EXISTS journey_response_id;

ALTER TABLE cli_responses
  DROP COLUMN IF EXISTS truform_response_id,
  DROP COLUMN IF EXISTS journey_response_id;

ALTER TABLE coupon_instances
  DROP COLUMN IF EXISTS journey_response_id;

ALTER TABLE automation_queue
  DROP COLUMN IF EXISTS journey_response_id;

ALTER TABLE automation_rules
  DROP COLUMN IF EXISTS journey_id;

-- reviews.journey_response_id may not exist on every deploy — IF EXISTS
-- handles both shapes. Some legacy code wrote to it via the
-- "offline review on unhappy completion" flow; that flow now writes
-- the surveyResponseId into reviews.metadata instead (see
-- survey-engine.service.ts).
ALTER TABLE reviews
  DROP COLUMN IF EXISTS journey_response_id;
