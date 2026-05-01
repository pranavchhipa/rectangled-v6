-- Phase 0 Fix 2 — AI reply approval gate.
--
-- The worker now leaves AI replies as 'draft' status in reviewResponses
-- when the review's rating is below autoApproveMinRating (default 5).
-- Default behaviour: requireApproval = true, autoApproveMinRating = 5.
-- Only 5-star auto-posts. Everything else lands in the inbox for review.
--
-- This migration backfills the actionConfig of every existing
-- ai_reply_review rule so they pick up the new defaults explicitly.
-- Without this, rules created before Phase 0 would still implicitly pass
-- the default safety check (the worker reads `requireApproval !== false`)
-- but having it explicit in the config makes the rule's behaviour
-- visible and editable from the dashboard.

UPDATE automation_rules
SET action_config = action_config || jsonb_build_object(
  'requireApproval', true,
  'autoApproveMinRating', 5
)
WHERE action_type = 'ai_reply_review'
  AND NOT (action_config ? 'requireApproval');
