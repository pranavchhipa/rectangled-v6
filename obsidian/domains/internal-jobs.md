---
type: domain
aliases: [Internal Jobs, Jobs, Schedules]
---

# Internal Jobs

Background / scheduled work surface. Where [[AI-Agent]] schedules fire, where [[Automations]] action chains run, where periodic syncs ([[Connectors]] polling) happen.

## Surface
- API: `apps/api/src/internal-jobs/`
- DB: `packages/db/src/schema/internal-jobs.ts`, `ai-schedules.ts`

## Likely shape
- Cron-style scheduling table
- Idempotent job handlers
- Backed by Redis ([[Tech-Stack]]) for queueing or by polling

## Connects to
- [[AI-Agent]] — schedule source
- [[Automations]] — action execution
- [[Connectors]] — periodic review fetch
- [[Notifications]] — fan-out delivery
