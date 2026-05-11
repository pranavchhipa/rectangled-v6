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

## redirectURL hard requirement (per platform) — SHIPPED

Onboarding **must** produce a working positive-path redirect URL for EVERY platform the owner enables, BEFORE onboarding can complete. This URL is what Journey A Step 3a.1 sends the customer to after a happy YES (see [[Customer-Journeys]]).

### How it's wired (Phase 2)

- **New Step 4 in the wizard** (`apps/web/src/app/dashboard/onboarding/page.tsx`): three URL inputs — Google, Zomato, Swiggy. Empty = platform not enabled.
- **Storage:** `workspaces.settings.defaultRedirectLinks` (`{ google?, zomato?, swiggy? }`). No schema migration — extension of the existing JSONB type.
- **API endpoints:** `trpc.onboarding.getRedirectLinks` + `trpc.onboarding.setRedirectLinks`.
- **Completion gate:** `OnboardingService.complete()` throws `PRECONDITION_FAILED` if zero URLs are set, with a friendly message pointing back to the URL step.
- **Survey engine fallback:** `getPublicLegacyJourney` now merges `workspaces.settings.defaultRedirectLinks` into the `screen.redirectLinks` object the FE receives. Survey-step explicit URL still wins per-key; workspace defaults fill the gaps.

### Open follow-up

- **Auto-resolve from GBP Place ID** is not implemented yet. Currently the wizard prompts for manual paste only. When the owner connects a GBP location, the Google URL could be derived as `https://search.google.com/local/writereview?placeid=<PLACEID>` and pre-filled. Spec calls for it; code doesn't do it yet.

Without the URL gate, the customer's happy path silently broke — they clicked YES, no tab opened, the AI-drafted review on their clipboard went nowhere. The Phase 2 commit closes that loophole.

## Connects to
- [[Auth]] — first-login redirect lands here
- [[Workspaces]], [[Locations]] — created during the flow
- [[Connectors]], [[Surveys]], [[QR]] — guided setup
- [[Business-Aspects]] — seeded from industry choice
