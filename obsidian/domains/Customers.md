---
type: domain
aliases: [Customer, Customers Module]
---

# Customers

Phonebook-shaped record per workspace. Customers are the subjects of [[Surveys]], [[Reviews]] (when matched), [[Coupons]], [[NEV]] emotion scores, and [[CLI]] loyalty index.

## Surface
- API: `apps/api/src/customer/`
- Web: `apps/web/src/app/dashboard/customers/`, `apps/web/src/components/customer/`
- DB: `packages/db/src/schema/customers.ts`
- Validators: `packages/shared/src/validators/customer.ts`

## What it stores
- Indian-name + phone shape (E.164 format)
- Email (optional), tags, source (manual / journey / connector)
- Workspace-scoped (no direct `location_id` — resolves via [[Surveys|survey_responses]])

## Connects to
- [[Surveys]] — survey responses link customer ↔ location
- [[Reviews]] — fuzzy-matched on phone/email when reviewer profile permits
- [[Coupons]] — issued coupons reference customers
- [[Escalations]] — bad responses escalate to staff queues
- [[NEV]] — emotion vector per customer
- [[CLI]] — loyalty index per customer
- [[WapiSnap]] / [[Email]] — outbound channels keyed by customer

## Notes
- 100+ seeded demo customers with realistic Indian names/phones (see [[Seed-Data]])
- Hotfix-5 added per-page location filtering for the customers list — uses subquery on `survey_responses.location_id`.
