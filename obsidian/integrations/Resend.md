---
type: integration
aliases: [Resend]
---

# Resend

Transactional email provider.

## Env
```
RESEND_API_KEY=re_...
EMAIL_FROM=reviews@exprectangled.com
```

## Used by
[[Email]] module — wraps the SDK and exposes a single `send()` surface that all callers use.

## Connects to
- [[Email]] — wrapper
- [[Auth]] (password reset) · [[Members]] (invites) · [[Notifications]] · [[Coupons]] · [[Appointments]] · [[Surveys]] — callers
