---
type: concept
aliases: [Hotfix Trail, Hotfix Log]
---

# Hotfix Trail (PRD §2-§7 + §4.5 public-page rebuild)

Chronology of the post-PRD-§4.5 hotfix series. Order matters — read the surrounding `CLAUDE.md` "Handoff" section before changing anything in [[Public-Pages]] or [[Surveys]].

| # | Commit | What it fixed | Touched |
|---|---|---|---|
| 2 | `1afb01b` | QR generator schema rejected missing `membershipId`; branding helper didn't compose "Workspace — Location" for single-location workspaces; truform fallback for legacy survey IDs | `qr.ts`, `branding.helper.ts`, `survey-engine.service.ts` |
| 3 | `1dd5836` | Custom journeys generated `/f/` QR (broken) instead of `/j/`; preview blocked on draft journeys (engine filtered `status='active'`); 5 spots of `template === 'quick'` checks were really meant to be `template !== 'deep'` | `survey.ts`, `survey-engine.service.ts`, `dashboard/journeys/[id]/page.tsx` |
| 4 | `4854e15` | "Continue" silently failed in journey preview because `submitLegacyJourneySchema.journeyScreenId` was UUID and synthetic IDs (`${surveyId}-screen`) aren't UUIDs | `survey.ts` validators (`uuid()` → `min(1).max(128)`) |
| 5 | `9e1592a` | Per-page **location filtering** added across the product. Per-row badges. **No global location switcher.** Customers resolve via subquery on `survey_responses.location_id` | 8 files across api + web |
| 6 | `0fb8933` | Hotfix-5 thresholds were `>= 2 active locations`. Pranav has 1 location (Woof Nest) so all the new UI was invisible. Threshold relaxed to `>= 1` | dashboard, journeys, responses-list, customers |
| 7 | `471d5aa` | First public-page design refactor — 4-style switcher via `?style=1\|2\|3\|4`. Stripped outer `<Card>` from `/f` | `branded-layout.tsx`, `f/[slug]/page.tsx` |
| 8 | `5af94f7` | **Owner rejected all 4 styles as "tatti"; Stitch ref (Afraa Lounge) was the actual target.** Replaced switcher with single design: navy 2-tone, concentric rings + topographic waves, 152px circular logo, brand-color inner ring, Cormorant Garamond italic cursive fallback, rectangled.io speech-bubble in footer | `globals.css`, `branded-layout.tsx`, `j/[slug]/page.tsx`, `f/[slug]/page.tsx` |
| 9 | `b3d40c5` | iPhone SE smoke test: (a) cursive showed "pranav's" because we took first word of full `displayName` — should have been the LOCATION half ("woof"); (b) header overflowed 667px viewport, causing scroll. Fixed cursive split + mobile-first sizing | `branded-layout.tsx`, `j/[slug]/page.tsx`, `f/[slug]/page.tsx` |

## Net effect
Every public-page screen now renders the Afraa-style navy/cream layout with curved white card, logo straddling the boundary, and content fitting one mobile viewport.

## Connects to
- [[Public-Pages]] — current state
- [[Surveys]] — engine fixes
- [[QR]] — Hotfix-2 + 3
- [[Branding-Resolution]] — Hotfix-2 single-location fall-through, Hotfix-9 cursive split
- [[Locations]] — Hotfix-5/6 per-page filters
- [[Mobile-First-Design]] — Hotfix-9 constraint
