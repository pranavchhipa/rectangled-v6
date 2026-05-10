---
type: domain
aliases: [Notifications]
---

# Notifications

In-app + email notifications for workspace members. The bell icon in the dashboard nav reads from this.

## Surface
- API: `apps/api/src/notification/`
- DB: `packages/db/src/schema/notifications.ts`
- Validators: `packages/shared/src/validators/notification.ts`

## Sources
- New low-rating [[Reviews]]
- New [[Escalations]] assigned to me
- [[Automations]] activity
- [[Billing]] events
- Workspace invites ([[Members]])

## Connects to
- [[Members]] — notifications are per-user-per-workspace
- [[Email]] — also fan out via Resend for high-priority items
- All trigger sources above
