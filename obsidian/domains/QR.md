---
type: domain
aliases: [QR, QR Codes]
---

# QR

QR-code generation for [[Locations]] / [[Surveys]] — printed at the storefront, scanned by customers, lands on [[Public-Pages|/j or /f]].

## Surface
- API: `apps/api/src/qr/`
- Validators: `packages/shared/src/validators/qr.ts`

## What it does
- Generates a per-location, per-survey URL with embedded slug
- Renders QR PNG/SVG (likely at API or via a Next.js OG-image route)
- Custom journeys generate `/j/<slug>` (Hotfix-3 fixed a bug that produced `/f/` instead)
- Validators require `membershipId` (Hotfix-2 added — was rejecting valid input)

## Connects to
- [[Locations]] — QR is location-scoped
- [[Surveys]] — QR points at a journey or truform slug
- [[Public-Pages]] — destination
- [[Hotfix-Trail]]
