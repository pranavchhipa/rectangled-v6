-- Phase 0 Stage C — escalation columns + dedupe indexes.
-- Runs after 0003 so the 'paused' enum value is visible to subsequent
-- index/predicate references.

-- ================================================================
-- Fix 5: SLA pause tracking columns
-- ================================================================

ALTER TABLE escalations
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS paused_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS total_pause_seconds INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN escalations.paused_at IS
  'Timestamp when the case was last moved to paused status. NULL when not paused. Phase 0 Fix 5.';
COMMENT ON COLUMN escalations.total_pause_seconds IS
  'Cumulative paused duration in seconds. Added to slaDeadline for effective breach calculation. Phase 0 Fix 5.';

-- ================================================================
-- Fix 6: Manual escalation dedupe (partial unique indexes)
-- ================================================================

-- One open manual escalation per review. Auto-generated escalations have
-- ruleId set so they're excluded; manual cases have ruleId = NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_escalations_manual_open_review
  ON escalations (review_id)
  WHERE rule_id IS NULL
    AND status IN ('open', 'in_progress', 'paused')
    AND review_id IS NOT NULL;

-- One open manual escalation per customer when the source is the customer
-- itself (e.g. complaint via support form, no specific review).
CREATE UNIQUE INDEX IF NOT EXISTS idx_escalations_manual_open_customer
  ON escalations (customer_id)
  WHERE rule_id IS NULL
    AND review_id IS NULL
    AND status IN ('open', 'in_progress', 'paused')
    AND customer_id IS NOT NULL;
