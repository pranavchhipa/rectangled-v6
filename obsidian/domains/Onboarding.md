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
5. **Resolve a positive-path redirectURL for each enabled platform** — see hard requirement below
6. Generate first QR ([[QR]]) and first journey ([[Surveys]])

## redirectURL hard requirement (per platform) — spec rule

Onboarding **must** produce a working positive-path redirect URL for EVERY platform the owner enables, BEFORE onboarding can complete. This URL is what Journey A Step 3a.1 sends the customer to after a happy YES (see [[Customer-Journeys]]).

Resolution chain:
1. **Auto-resolve first.** For Google, use the location's Place ID (from the connected [[Google-Business-Profile]]) to construct the "write a review" URL deterministically. For Zomato / Swiggy / others, use search + heuristics.
2. **Manual fallback.** If auto-resolve fails for a platform, **block onboarding completion** and prompt the owner to paste the URL manually for that platform. Don't silently skip — Journey A's happy YES has nowhere to send the customer if this URL is missing.
3. Resolved URLs are stored on `surveys.settings.redirectLinks` (and platform IDs on `locations.gbpPlaceId` etc.) so the survey engine can read them at public-page render time.

Without this guarantee, the customer's happy path silently breaks — they click YES, no tab opens, the AI-drafted review on their clipboard goes nowhere. Treat the URL set as a completion gate, not a nice-to-have.

## Connects to
- [[Auth]] — first-login redirect lands here
- [[Workspaces]], [[Locations]] — created during the flow
- [[Connectors]], [[Surveys]], [[QR]] — guided setup
- [[Business-Aspects]] — seeded from industry choice
