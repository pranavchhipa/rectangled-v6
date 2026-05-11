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

## Phase 2.1 — Auto-resolve Google URL via Places API (SHIPPED)

Step 4 now has a "Find your business on Google" search box above the manual Google URL input. Owner types ≥3 chars → 400ms debounce → server hits Google Places API Text Search (`GOOGLE_API_KEY` env) → returns up to 5 matches (name + formatted address) → owner clicks one → the writereview URL is constructed deterministically as `https://search.google.com/local/writereview?placeid=<PLACEID>` and prefilled into the Google URL field.

- **Endpoint:** `trpc.onboarding.searchGooglePlaces({ workspaceId, query })`
- **Place ID storage:** persisted on `workspaces.settings.googlePlaceId` so the later [[Google-Business-Profile|GBP]] connector flow can claim the exact place without making the owner pick again.
- **Auto-filled badge:** appears on the Google URL field when the value came from search; clears if the owner manually edits.
- **Fallback chain:** if `GOOGLE_API_KEY` is missing the server returns `{ results: [] }` cleanly; if Places API errors the UI shows "Search unavailable. Paste the URL manually below." — the manual URL field is always usable as escape hatch.
- **Cost:** Places API Text Search is paid (~$32/1000 requests) but covered by Google's $200/mo Maps Platform free credit at onboarding volume.

Without the URL gate, the customer's happy path silently broke — they clicked YES, no tab opened, the AI-drafted review on their clipboard went nowhere. Phase 2 closed that loophole; Phase 2.1 reduces the manual-paste burden so most SMB owners click their business name once and move on.

## Connects to
- [[Auth]] — first-login redirect lands here
- [[Workspaces]], [[Locations]] — created during the flow
- [[Connectors]], [[Surveys]], [[QR]] — guided setup
- [[Business-Aspects]] — seeded from industry choice
