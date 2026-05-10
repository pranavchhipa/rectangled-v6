---
type: domain
aliases: [AI Agent]
---

# AI-Agent

Higher-level AI orchestration above [[AI-Response]] — schedules drafts, composes posts ([[RAIS]]), drives recommendations.

## Surface
- API: `apps/api/src/ai-agent/`
- DB: `packages/db/src/schema/ai-schedules.ts`

## What it does
- Owns the cron-like scheduling for AI tasks (review-reply runs, post composition, …)
- Coordinates multi-step workflows that need persistence between LLM calls

## Connects to
- [[AI-Response]] — request draft replies
- [[RAIS]] — schedule social content creation
- [[OpenRouter]] — provider
- [[internal-jobs]] — execution surface for scheduled work
