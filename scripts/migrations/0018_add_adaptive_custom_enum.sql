-- Hotfix PRD §2 — extend the survey_template enum.
--
-- 'adaptive' = the locked v2 Adaptive Customer Journey flow (random metric →
--              threshold-based happy/unhappy split → review prompt or aspect
--              feedback). Pre-merger this was the default journey behaviour.
--              The merger collapsed it into template='quick'/mode='intelligent'
--              and routed it through the step-graph engine. Migration 0019
--              flips those rows to 'adaptive' so they route through the
--              dedicated AdaptiveEngineService instead.
--
-- 'custom'   = manually-built journey via the §3 wizard. Reserved here so
--              the schema is stable for that follow-up PR; nothing references
--              it yet.
--
-- ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent in Postgres 12+ and is a
-- non-blocking metadata change (no table rewrite).
--
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction in Postgres
-- versions older than 14 in some edge cases. The migration runner already
-- wraps each migration in a transaction; if this fails on the prod cluster,
-- split into a separate one-shot psql command. Postgres 16 (this deploy)
-- handles this cleanly.

ALTER TYPE survey_template ADD VALUE IF NOT EXISTS 'adaptive';
ALTER TYPE survey_template ADD VALUE IF NOT EXISTS 'custom';
