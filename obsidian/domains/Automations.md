---
type: domain
aliases: [Automation, Automations Module]
---

# Automations

Workspace-defined triggers + actions. Like Zapier, but scoped to Rectangled events.

## Surface
- API: `apps/api/src/automation/`
- Web: `apps/web/src/app/dashboard/automations/`
- DB: `packages/db/src/schema/automations.ts`
- Validators: `packages/shared/src/validators/automation.ts`

## Triggers (typical)
- New review (rating ≤ N)
- Journey response received
- Customer segment ([[CLI]]) change
- Coupon redeemed

## Actions (typical)
- Issue [[Coupons|coupon]]
- Create [[Escalations|escalation]]
- Send [[Email]] / [[WapiSnap]] message
- Tag customer

## Connects to
- [[Reviews]], [[Surveys]], [[CLI]] — trigger sources
- [[Coupons]], [[Escalations]], [[Email]], [[WapiSnap]] — action sinks
- [[internal-jobs]] — execution surface
- [[Notifications]] — owner-visible activity log
