---
type: domain
aliases: [Email]
---

# Email

Outbound email via [[Resend]]. From address: `reviews@exprectangled.com` (env `EMAIL_FROM`).

## Surface
- API: `apps/api/src/email/`

## Use cases
- [[Auth]] password reset links
- [[Members]] invite emails
- [[Notifications]] high-priority fan-out
- [[Coupons]] delivery
- [[Appointments]] confirmation + reminder
- [[Surveys]] response receipts

## Connects to
- [[Resend]] — provider
- All sources above
