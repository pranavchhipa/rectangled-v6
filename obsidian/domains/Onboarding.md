---
type: domain
aliases: [Onboarding, First-Run]
---

# Onboarding

First-run wizard for new workspaces — collects industry, primary location, brand color, then connects review platforms.

## Surface
- API: `apps/api/src/onboarding/`
- Web: `apps/web/src/app/dashboard/onboarding/`
- DB: `packages/db/src/schema/onboarding.ts`
- Validators: `packages/shared/src/validators/onboarding.ts`
- Constants: `packages/shared/src/constants/industries.ts`

## Steps (typical)
1. Pick industry (drives default [[Business-Aspects]])
2. Create first [[Locations|location]]
3. Pick brand color (drives [[Branding-Resolution]])
4. Connect [[Google-Business-Profile]] / [[Zomato]] via [[Connectors]]
5. Generate first QR ([[QR]]) and first journey ([[Surveys]])

## Connects to
- [[Auth]] — first-login redirect lands here
- [[Workspaces]], [[Locations]] — created during the flow
- [[Connectors]], [[Surveys]], [[QR]] — guided setup
- [[Business-Aspects]] — seeded from industry choice
