---
type: domain
aliases: [RAIS, AI Studio, Social Content]
---

# RAIS — AI Social Content

AI-drafted social content (GBP "What's New" posts, future channels). Marketed as "AI Studio" in the dashboard.

## Surface
- API: `apps/api/src/rais/`
- Web: `apps/web/src/app/dashboard/rais/`
- DB: `packages/db/src/schema/rais.ts`
- Validators: `packages/shared/src/validators/rais.ts`

## Flow
1. User picks a brief / template / occasion in the UI
2. RAIS service composes prompt + calls [[OpenRouter]]
3. Returned copy + image suggestion saved as a draft
4. User edits / approves → publishes via [[Listings]] (GBP post) or via [[Connectors]] adapters

## Connects to
- [[OpenRouter]] — provider
- [[AI-Agent]] — scheduler/orchestrator
- [[Listings]] — outbound publish surface
- [[Connectors]] — particularly GBP
