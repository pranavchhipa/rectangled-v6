-- Phase 0 Stage C escalation hardening — enum additions only.
--
-- ALTER TYPE ADD VALUE works inside a transaction in PG 12+, BUT the new
-- value cannot be USED in the same transaction (e.g. in a WHERE clause).
-- That's why this migration only adds the values; 0004 follows up with the
-- columns and indexes that reference 'paused'.

-- Fix 5: SLA pause status
ALTER TYPE escalation_status ADD VALUE IF NOT EXISTS 'paused';

-- Fix 11: routing-failed notification
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'routing_failed';
