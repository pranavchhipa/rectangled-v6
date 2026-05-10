---
type: domain
aliases: [WapiSnap, WhatsApp]
---

# WapiSnap

WhatsApp messaging surface. Talks to a separate **WapiSnap Bridge** service over HMAC-SHA256 signed HTTP. Used for outbound WhatsApp and inbound webhooks.

## Surface
- API: `apps/api/src/wapisnap/`
- DB: `packages/db/src/schema/wapisnap.ts`
- Validators: `packages/shared/src/validators/wapisnap.ts`

## Env
- `WAPISNAP_BRIDGE_URL` — bridge endpoint (e.g. `http://localhost:3050/bridge`)
- `WAPISNAP_BRIDGE_SECRET` — HMAC key

## Use cases
- Send [[Coupons]] via WhatsApp
- [[Surveys]] reminders / feedback nudges
- [[Notifications]] fan-out
- [[Automations]] action

## Connects to
- [[WapiSnap-Bridge]] — external service
- [[Coupons]], [[Surveys]], [[Notifications]], [[Automations]] — sources
- [[Customers]] — WhatsApp number is the customer's phone

## Notes
- The bridge architecture rationale lives in `INTEGRATION_PROPOSAL_V6_BRIDGE.md` (root) — read it before changing the contract.
