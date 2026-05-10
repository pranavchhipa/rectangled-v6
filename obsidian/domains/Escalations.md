---
type: domain
aliases: [Escalations, CX-Routing, CX Routing]
---

# Escalations (CX-Routing)

Rules engine that routes negative feedback to the right human (or queue) before it becomes a public 1-star review.

## Surface
- API: `apps/api/src/cx-routing/`
- Web: `apps/web/src/app/dashboard/escalations/`, `apps/web/src/app/dashboard/escalations/rules/`
- DB: `packages/db/src/schema/cx-routing.ts`
- Validators: `packages/shared/src/validators/cx-routing.ts`

## Model
- **Rules** — workspace-scoped; conditions on rating threshold, aspect tag, location, time, …
- **Escalations** — instances created when a rule fires; SLA-tracked
- **Status** — open / in-progress / resolved / breached

## Triggers
- Unhappy branch in [[Surveys]]
- Low-rating [[Reviews]]
- Manual creation from inbox

## Connects to
- [[Surveys]] — primary trigger source
- [[Reviews]] — secondary trigger source
- [[Notifications]] — assignee alert
- [[Members]] — escalations are assigned to staff
- [[Automations]] — can be the action of an automation
- [[Reports]] — SLA breach metrics

## Notes
- 50+ seeded escalations with SLA tracking ([[Seed-Data]]).
