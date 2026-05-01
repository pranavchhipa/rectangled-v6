-- Fix 1: Idempotency on automation_queue
--
-- Adds a deterministic trigger_key column so the same trigger event for the
-- same source (review, journey response, customer-day, etc.) cannot enqueue
-- duplicate work. Combined with the worker (Fix 13a), this prevents double
-- coupon issuance and duplicate WhatsApp/email sends.
--
-- The unique index is partial — rules without a trigger_key (legacy rows
-- pre-fix, or future internal jobs) are excluded so they don't conflict.

ALTER TABLE automation_queue
  ADD COLUMN IF NOT EXISTS trigger_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_idempotency
  ON automation_queue (rule_id, trigger_key)
  WHERE trigger_key IS NOT NULL;

COMMENT ON COLUMN automation_queue.trigger_key IS
  'Deterministic key per (rule, source) for idempotent enqueue. Format depends on triggerEvent — see apps/api/src/automation/triggerKey.ts';
