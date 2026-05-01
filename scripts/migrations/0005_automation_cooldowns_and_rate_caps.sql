-- Phase 0 Stage D — automation rule cooldowns + workspace-level customer rate caps.
--
-- Fix 4: cooldown_hours per rule. Skip enqueue if the same (rule, customer)
--   was enqueued (or completed) within the cooldown window. Default sensible
--   values for existing send_coupon rules so live data isn't suddenly more
--   permissive than intended.
--
-- Fix 8: customer-level rate caps in workspaces.settings.customerRateCap.
--   Worker checks limits before dispatching outbound actions.

-- ================================================================
-- Fix 4: Cooldowns on automation rules
-- ================================================================

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER;

COMMENT ON COLUMN automation_rules.cooldown_hours IS
  'Per-customer cooldown window in hours. NULL = no cooldown. Phase 0 Fix 4.';

-- Sensible defaults: send_coupon rules get a 90-day cooldown unless the
-- owner has already opinionated. Other action types stay null (no change).
UPDATE automation_rules
SET cooldown_hours = 2160
WHERE action_type = 'send_coupon'
  AND cooldown_hours IS NULL;

-- Speed up the cooldown lookup (rule_id + customer_id + recent enqueue).
CREATE INDEX IF NOT EXISTS idx_automation_queue_cooldown_lookup
  ON automation_queue (rule_id, customer_id, created_at);

-- ================================================================
-- Fix 8: Customer-level rate caps default
-- ================================================================

-- Backfill workspaces.settings.customerRateCap with sane defaults.
-- Only sets the field if it doesn't already exist — opinionated workspaces
-- keep their config.
UPDATE workspaces
SET settings = settings || jsonb_build_object(
  'customerRateCap',
  jsonb_build_object(
    'maxMessagesPerDay', 3,
    'maxCouponsPerMonth', 1,
    'maxActionsPerWeek', 10
  )
)
WHERE NOT (settings ? 'customerRateCap');
