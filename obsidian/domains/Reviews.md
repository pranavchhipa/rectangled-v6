---
type: domain
aliases: [Review, Reviews Module]
---

# Reviews

Inbound review records pulled from [[Connectors|external platforms]] (Google, Zomato) and from internal [[Surveys|journeys/truforms]] when they include a public review prompt. The inbox is the heartbeat of the product.

## Surface
- API: `apps/api/src/review/`
- Web (canonical surface): `apps/web/src/app/dashboard/inbox/page.tsx` — the unified review workflow tool (table + detail sheet, opens on row click)
- Web (peer): `apps/web/src/app/dashboard/responses/page.tsx`
- Web components: `apps/web/src/components/review/` (`review-table`, `review-detail-sheet`, `review-filters`, `review-stats-bar`, `bulk-action-bar`, `ai-response-section`, `star-rating`), `apps/web/src/components/responses/responses-list.tsx`

> **Refactor `79fa581`:** `/dashboard/reviews/` was deleted as an orphan (only the home KPI linked to it). The tabular layout was ported into Inbox; per-row actions (AI Generate, Escalate, Send Coupon) live in the detail sheet. Home KPI "Sync your first reviews" now points to `/dashboard/inbox`.
- DB: `packages/db/src/schema/reviews.ts`
- Validators: `packages/shared/src/validators/review.ts`

## What it stores
- Source platform (Google / Zomato / internal)
- Star rating 1-5, reviewer name, body, location_id
- AI-generated draft / approved / posted response (foreign-key to [[AI-Response|ai_responses]])
- Sentiment + aspect tags (linked to [[Business-Aspects]])
- Status flags for moderation, escalation, posting

## Pipeline
1. [[Connectors]] poll or webhook-receive new reviews
2. [[AI-Response]] drafts a reply (gated on workspace settings)
3. Human approves in inbox UI
4. Reply posted back via the same connector adapter (Google) or via [[Email]]/[[WapiSnap]] for internal reviews

## Connects to
- [[Connectors]] — source of inbound reviews
- [[AI-Response]] — drafts replies
- [[Customers]] — fuzzy match on phone/email when possible
- [[Business-Aspects]] — aspect-tagging populates analytics
- [[NEV]], [[CLI]] — derive emotion + loyalty signals
- [[Escalations]] — low-rating reviews trigger CX-routing rules
- [[Reports]] — review-velocity, rating-distribution, response-rate cards
