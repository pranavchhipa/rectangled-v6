---
type: domain
aliases: [Coupons]
---

# Coupons

Coupon issuance + redemption. Templates per workspace; instances issued per customer (typically tied to a journey response or a [[CLI]] segment).

## Surface
- API: `apps/api/src/coupon/`
- Web: `apps/web/src/app/dashboard/coupons/`
- DB: `packages/db/src/schema/coupons.ts`
- Validators: `packages/shared/src/validators/coupon.ts`

## Model
- Templates → many issued instances
- Each instance has a customer_id, location_id, expiry, status (issued/redeemed/expired)

## Connects to
- [[Customers]] — recipient
- [[Surveys]] — happy-path branch can auto-issue a coupon
- [[CLI]] — segment-targeted campaigns
- [[Automations]] — trigger issuance on events
- [[Email]] / [[WapiSnap]] — delivery channels
- [[Notifications]] — owner alerts on redemption

## Notes
- Demo seed: 20+ templates + 100+ issued coupons (see [[Seed-Data]]).
