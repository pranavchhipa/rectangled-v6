-- Hotfix PRD §3 (Step A) — delete the abandoned "Test 5" survey so the
-- new SurveyStep validators (validators/survey-steps.ts) can be enforced
-- on `survey.update.steps` without regressing existing data.
--
-- Background:
--   The dry-run pass (scripts/dry-run-step-validators.mjs) found 1 of 20
--   surveys with structurally broken steps:
--     - Survey: "Test 5" (slug f-4054d211-c)
--     - 0 responses ever
--     - step[3] (ask_metric, id=step_4): config.onComplete.nextStepId=null
--     - step[4] (branch_by_answer, id=step_5):
--         missing required `answerFromStepId` (had stale `fromStepId` instead),
--         empty `branches[]` array,
--         null `defaultNextStepId`
--   The graph couldn't have been served by the engine — it would have
--   stalled at step_4 because step_5 has no functioning fields. Pranav's
--   own mid-edit save; nothing of value to preserve.
--
-- Defensive filters:
--   - slug match (specific row identifier)
--   - name match (belt-and-suspenders against slug collision in non-prod
--     environments)
--   - NOT EXISTS responses (don't delete in environments where Test 5
--     somehow received traffic)
--
-- Idempotent: subsequent runs delete 0 rows once the row is gone.

DELETE FROM surveys
WHERE slug = 'f-4054d211-c'
  AND id IN (
    SELECT s.id FROM surveys s
    WHERE s.name = 'Test 5'
      AND NOT EXISTS (
        SELECT 1 FROM survey_responses r WHERE r.survey_id = s.id
      )
  );
