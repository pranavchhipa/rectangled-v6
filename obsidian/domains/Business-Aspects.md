---
type: domain
aliases: [Business Aspects, Aspects]
---

# Business Aspects

Workspace-defined tags — "service", "ambience", "value", "cleanliness", … — used to categorize [[Reviews]] and [[Surveys|survey responses]] by topic. Seeded from industry choice during [[Onboarding]].

## Surface
- API: `apps/api/src/business-aspect/`
- DB: `packages/db/src/schema/business-aspects.ts`
- Validators: `packages/shared/src/validators/business-aspect.ts`
- Constants: `packages/shared/src/constants/business-aspects.ts`

## What it powers
- Aspect-tagging on [[Reviews]] (often AI-classified)
- Aspect chips on [[Public-Pages|/j and /f pages]] for unhappy feedback collection
- The **aspect-performance-chart** in [[Reports]]

## Connects to
- [[Reviews]] — aspect tags
- [[Surveys]] — aspect chips on responses
- [[Reports]] — aspect-performance chart
- [[AI-Response]] — aspect-aware reply drafting
- [[Onboarding]] — defaults seeded by industry
