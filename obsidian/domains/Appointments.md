---
type: domain
aliases: [Appointments, Booking]
---

# Appointments

Booking flow — public `/book` route. Lets customers schedule appointments at a [[Locations|location]].

## Surface
- API: `apps/api/src/appointment/`
- Web: `apps/web/src/app/book/`, `apps/web/src/app/dashboard/appointments/`
- DB: `packages/db/src/schema/appointments.ts`
- Validators: `packages/shared/src/validators/appointment.ts`

## Connects to
- [[Locations]] — appointment is location-scoped
- [[Customers]] — booker becomes a customer record
- [[Notifications]] / [[Email]] — confirmation + reminders
- [[Surveys]] — post-appointment feedback flow
