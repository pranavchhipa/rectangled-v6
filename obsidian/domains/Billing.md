---
type: domain
aliases: [Billing, Subscription]
---

# Billing

Subscription billing via [[Razorpay]] (test mode currently). Plans, invoices, webhooks.

## Surface
- API: `apps/api/src/billing/`
- Web: `apps/web/src/app/dashboard/billing/`, `apps/web/src/app/dashboard/admin/billing/`
- DB: `packages/db/src/schema/billing.ts`
- Validators: `packages/shared/src/validators/billing.ts`

## Env
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

## Lazy-init gotcha
`getRazorpay()` factory in `billing.service.ts` creates the client on first use. **Crashes if loaded at module level without env vars.** Don't refactor it back to top-level import — see [[Known-Issues]].

## Connects to
- [[Razorpay]] — provider
- [[Workspaces]] — subscription is per-workspace
- [[Notifications]] — payment events
- [[Email]] — receipts, dunning
- Demo seed: 1 Pro-plan subscription on `test@example.com` workspace
