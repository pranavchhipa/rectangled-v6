-- Fix 3: Async escalation evaluation
--
-- Adds an internal_jobs table for system-internal async work (escalation
-- evaluation, future event-bus consumers, etc.). Distinct from
-- automation_queue which is workspace/customer/review-keyed and visible to
-- end users in the UI.
--
-- Why a separate table:
-- - Different retry semantics (3 attempts, fixed 30s backoff vs. per-action
--   policy)
-- - Different lifecycle (system jobs aren't surfaced to dashboard)
-- - Cleaner mental model (automation = user-configured rules, internal_jobs
--   = system plumbing)

CREATE TABLE IF NOT EXISTS internal_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMP NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cheap lookups for the worker poll. Partial index on pending only.
CREATE INDEX IF NOT EXISTS idx_internal_jobs_pending_due
  ON internal_jobs (scheduled_for)
  WHERE status = 'pending';

-- For the watchdog reset (mirrors the automation pattern).
CREATE INDEX IF NOT EXISTS idx_internal_jobs_processing_stale
  ON internal_jobs (updated_at)
  WHERE status = 'processing';

COMMENT ON TABLE internal_jobs IS
  'System-internal async work queue. Distinct from automation_queue (user-facing).';
