---
type: integration
aliases: [Razorpay]
---

# Razorpay

Payments / subscription billing. Test mode currently.

## Env
```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

## Lazy init
`apps/api/src/billing/billing.service.ts` exposes `getRazorpay()` — creates the client on first use. **Do NOT import the SDK at module top-level**: it crashes when env vars are missing (e.g. CI builds, fresh dev clones).

## Webhook
A REST controller (one of the few non-tRPC endpoints) verifies the HMAC against `RAZORPAY_WEBHOOK_SECRET`.

## Connects to
- [[Billing]] — consumer module
- [[Notifications]] — payment events
- [[Email]] — receipts via Resend
