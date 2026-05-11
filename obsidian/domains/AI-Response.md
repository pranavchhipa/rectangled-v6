---
type: domain
aliases: [AI Response, AI Reply Drafts]
---

# AI-Response

AI-generated draft replies to inbound [[Reviews]]. Uses [[OpenRouter]] (default model `openai/gpt-4o-mini`). Drafts move through draft → approved → posted states.

## Surface
- API: `apps/api/src/ai-response/`
- Web: review-inbox UI in `apps/web/src/components/responses/`, `apps/web/src/app/dashboard/responses/`
- Validators: `packages/shared/src/validators/ai-response.ts`

## Flow
1. New review row appears (from [[Connectors]] poll/webhook)
2. AI-response service composes a prompt (review text + workspace tone settings + [[Business-Aspects|aspect tags]])
3. OpenRouter call → draft response
4. Draft saved with status `draft`
5. User approves / edits in inbox → status `approved`
6. Connector adapter posts back → status `posted`

## Not to be confused with…

`survey-engine.service.ts → generateHappyReviewDraft` (added in Phase 1, `0eee598`). That endpoint composes the **customer's own** positive-review text for the clipboard hand-off in [[Public-Pages|/j/{slug}]] Step 3a.1. Different direction — this module drafts the **owner's reply** to an existing inbound review. The two share the OpenAI client construction pattern but live in different modules.

## Connects to
- [[Reviews]] — parent rows
- [[OpenRouter]] — AI provider
- [[AI-Agent]] — supervises / orchestrates
- [[Business-Aspects]] — aspect-aware drafting
- [[Notifications]] — alert when low-rating review needs attention
- [[Reports]] — response-rate-card metric
- [[Surveys]] — peer AI surface (customer-side review drafting)
