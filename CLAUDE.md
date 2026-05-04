# OptimizerV6 — rectangled.io

## What is this project?
AI-native Online Reputation Management (ORM) platform for Indian SMBs. Built as a Turborepo monorepo.

## Quick Start
```bash
docker compose up -d          # PostgreSQL + Redis
npm run build --workspace=packages/db
npm run build --workspace=packages/shared
npm run dev --workspace=apps/api   # NestJS API on :3001
npm run dev --workspace=apps/web   # Next.js on :3000
```

**Demo Login:** `test@example.com` / `password123`
**DB Schema Push:** `cd packages/db && DATABASE_URL="postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6" npx drizzle-kit push`

## Architecture

### Monorepo Structure
```
apps/
  api/          → NestJS + tRPC (port 3001)
  web/          → Next.js 15 + shadcn/ui (port 3000)
packages/
  db/           → Drizzle ORM schemas, PostgreSQL
  shared/       → Zod validators, constants, types
```

### Tech Stack
- **Frontend:** Next.js 15 (App Router), TailwindCSS v4, shadcn/ui, Zustand (auth store), React Query via tRPC
- **Backend:** NestJS with tRPC routers (not REST), Drizzle ORM, PostgreSQL 16, Redis 7
- **AI:** OpenRouter (OpenAI SDK wrapper) → GPT-4o-mini default
- **Payments:** Razorpay (test mode)
- **Email:** Resend
- **WhatsApp:** WapiSnap Bridge (HMAC-SHA256 signed HTTP)

### Key Patterns
1. **tRPC dual-router:** Static router for type export (`null as any` services), runtime router in `onModuleInit` with real DI services
2. **Auth:** JWT 30-day access token, stored in Zustand → localStorage key `rectangled-auth`
3. **All queries are workspace-scoped:** `enabled: !!currentWorkspaceId`
4. **Every service has `requireMembership()`** for permission checks
5. **Lazy initialization** for external clients (Razorpay, OpenRouter) to avoid module-load crashes
6. **Shared package exports via `export *`** from validators — rebuild shared after adding new validators

### Database
- 28 schema files in `packages/db/src/schema/`
- All enums in `enums.ts`
- Relations in `relations.ts`
- Export everything from `index.ts`
- **Drizzle-kit push** (not migrations) for dev: needs `DATABASE_URL` env var explicitly

### API Modules (27 feature modules)
auth, workspace, location, member, connector (GBP + Zomato adapters), review, listing, customer, onboarding, business-aspect, journey, truform, billing, ai-response, coupon, nev (emotion scoring), cli (loyalty index), qr, automation, cx-routing (escalations), notification, report, email, wapisnap, rais (AI social content), trpc (aggregator), database

### Frontend Pages (28 dashboard pages)
login, dashboard, inbox, analytics, listings, settings, journeys, journeys/[id], truforms, truforms/[id], coupons, reports, reports/[id], escalations, escalations/rules, billing, automations, rais (AI Studio), customers, connectors, locations, members, onboarding, reviews, admin, admin/billing, listings/[id], listings/posts

### Analytics Components (13 chart components)
health-score-card, rating-distribution-chart, review-velocity-chart, sentiment-chart, platform-comparison-chart, rating-trend-chart, response-rate-card, top-themes-chart, source-donut-chart, aspect-performance-chart, sentiment-trend-chart, nev-emotion-wheel, cli-segment-chart

## Environment Variables (.env at project root)
```
DATABASE_URL=postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-do-not-use-in-production-12345
JWT_EXPIRY=30d
API_PORT=3001
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_API_KEY=<your-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini
GOOGLE_CLIENT_ID=<your-id>
GOOGLE_CLIENT_SECRET=<your-secret>
GOOGLE_REDIRECT_URL=http://localhost:3050/gbp/auth
RESEND_API_KEY=<your-key>
EMAIL_FROM=reviews@exprectangled.com
WAPISNAP_BRIDGE_URL=http://localhost:3050/bridge
WAPISNAP_BRIDGE_SECRET=
RAZORPAY_KEY_ID=<your-test-key>
RAZORPAY_KEY_SECRET=<your-secret>
RAZORPAY_WEBHOOK_SECRET=
```

## Known Issues / Gotchas
1. **Windows NestJS compilation:** Takes 3-5 min in watch mode. Be patient.
2. **Razorpay lazy init:** `getRazorpay()` function in billing.service.ts — crashes if loaded at module level without env vars
3. **Port conflicts:** Kill orphaned processes: `powershell -Command "Get-NetTCPConnection -LocalPort 3000,3001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`
4. **DB identifier truncation:** PostgreSQL warns about long FK names — cosmetic only
5. **Shared package rebuild:** After adding validators/constants, run `npm run build --workspace=packages/shared` before API restart
6. **tRPC route path warning:** `trpc/(.*)` path shows NestJS deprecation warning — works fine, cosmetic
7. **Optional mutations on frontend:** Some pages use `trpc.xxx?.useMutation?.()` pattern for graceful degradation

## Seed Data
Database has been seeded with comprehensive demo data for `test@example.com`:
- 100+ customers with realistic Indian names/phones
- 500+ Google & Zomato reviews (1-5 stars, real-sounding text)
- 200+ AI-generated review responses (draft/approved/posted)
- 50+ escalations with SLA tracking
- 20+ coupon templates + 100+ issued coupons
- Journey responses, TruForm responses
- NEV emotion data, CLI loyalty scores
- Notifications, automation rules, reports
- 5 team members with different roles
- 3 locations (Mumbai, Pune, Bangalore)
- Billing subscription (Pro plan)

## PRD Reference
Original PRD: `OptimizerV6_Blueprint_V3_1.docx` — covers all features in detail.
Integration proposal: `INTEGRATION_PROPOSAL_V6_BRIDGE.md` for WapiSnap architecture.

---

# 🛠️ Handoff to Next Agent (May 2026)

> **Context:** This codebase is mid-flight on a series of "hotfix" commits
> against PRD §2-§7 plus emergent owner feedback on the public review
> pages (`/j/{slug}`, `/f/{slug}`). The Claude Code plan is expiring; the
> next agent (likely Antigravity) needs to pick up cold. Read this whole
> section before touching code. Last shipped commit: `b3d40c5` (hotfix-9).

## Working Directory + Workflow

- **Local repo path:** `C:\Users\Pranav\.gemini\antigravity\scratch\Rectangled.io_V6\`
  (the user's `.gemini/antigravity/scratch/` is where Antigravity clones).
- **Production:** DigitalOcean App Platform — `api` + `web` web services.
  App URL: `https://rectangled-io-g43cg.ondigitalocean.app`. Custom
  domain: `rectangled.io` (likely; confirm via `gh` or DO dashboard).
- **Deploy trigger:** push to `origin/main` → DO auto-redeploys both
  components in 2-5 min. There's no separate staging environment.
- **CI:** none right now. Local verify before pushing:
  ```bash
  cd apps/web && npx tsc --noEmit       # web typecheck
  cd packages/shared && npx tsc -p .    # shared package
  cd apps/api && npx nest build         # api compile
  npx vitest run                        # 111 tests, all should pass
  ```
- **Baseline TS error count on web is ~11-14**, all from legacy
  modules (escalations, listings, members, settings, platform-icons).
  Don't fix these as part of unrelated work — they're known. New
  errors introduced by your changes are the only signal.
- **Commit style:** see recent log. Pattern is `feat:` / `fix:` / `chore:`
  + concise subject + bullet body explaining "what" and "why" + the
  Co-Authored-By trailer. The user prefers thorough commit messages.
- **Hooks:** pre-commit hook runs (don't `--no-verify`). If it fails,
  read the error and fix it; do NOT amend a hook-failed commit, create
  a new one.

## Recent Work (Hotfixes 2 → 9) — Customer-facing Public Pages

The journey/truform public pages (`/j/{slug}` and `/f/{slug}`) went
through 8 hotfixes after PRD §4.5 was shipped. Order matters; here's
what each one did and what files it touched.

| # | Commit (hash) | What it fixed | Touched |
|---|---|---|---|
| 2 | `1afb01b` | QR generator schema rejected missing `membershipId`; branding helper didn't compose "Workspace — Location" for single-location workspaces; truform fallback for legacy survey IDs | `qr.ts`, `branding.helper.ts`, `survey-engine.service.ts` |
| 3 | `1dd5836` | Custom journeys generated `/f/` QR (broken) instead of `/j/`; preview blocked on draft journeys (engine filtered `status='active'`); 5 spots of `template === 'quick'` checks were really meant to be `template !== 'deep'` | `survey.ts` validators, `survey-engine.service.ts` (preview/allowDraft), `apps/web/src/app/dashboard/journeys/[id]/page.tsx` |
| 4 | `4854e15` | "Continue" button silently failed in journey preview because `submitLegacyJourneySchema.journeyScreenId` was `z.string().uuid()` and synthetic IDs (`${surveyId}-screen`) aren't UUIDs. Frontend's `try/catch` swallowed the Zod error | `survey.ts` validators (`uuid()` → `min(1).max(128)`) |
| 5 | `9e1592a` | Per-page **location filtering** added across the product (Customer Journeys, Responses, Customers, Dashboard rollups, custom journey wizard). Per-row badges. **No global location switcher** — per Pranav's explicit ask. Customers resolve via subquery on `survey_responses.location_id` since they don't have direct location_id | 8 files across api + web |
| 6 | `0fb8933` | Hotfix-5 thresholds were `>= 2 active locations` to show filters. Pranav has 1 location (Woof Nest) so all the new UI was invisible. Threshold relaxed to `>= 1` | `dashboard/page.tsx`, `journeys/page.tsx`, `responses-list.tsx`, `customers/page.tsx` |
| 7 | `471d5aa` | First public-page design refactor — 4-style switcher via `?style=1\|2\|3\|4` query param. Stripped outer `<Card>` from `/f` so layout could provide the surface | `branded-layout.tsx`, `f/[slug]/page.tsx` |
| 8 | `5af94f7` | **Owner rejected all 4 styles as "tatti"; Stitch reference (Afraa Lounge) was the actual target.** Replaced switcher with single design: navy 2-tone with concentric rings + topographic waves, 152px circular logo straddling the boundary, brand-color inner ring, Cormorant Garamond italic cursive fallback, rectangled.io speech-bubble brand mark in footer. ALL inner content (`MetricInput`, `HappyPrompt`, `UnhappyFeedback`, `NpsInput`, `CsatInput`, `CesInput`, contact fields, submit, thank-you) refactored to navy/brand/gold palette via CSS vars | `globals.css` (Cormorant import), `branded-layout.tsx`, `j/[slug]/page.tsx`, `f/[slug]/page.tsx` |
| 9 | `b3d40c5` | iPhone SE smoke test revealed (a) cursive showed "pranav's" because `displayName` resolved to "Pranav's Business — Woof Nest" and we took the first word — should have been the LOCATION half ("woof"); (b) navy header `minHeight: 36vh` (240px) + 500px content overflowed 667px viewport, causing scroll. Fixed cursive split on " — " separator + made all sizing mobile-first | `branded-layout.tsx`, `j/[slug]/page.tsx`, `f/[slug]/page.tsx` |

**Net effect:** every public-page screen — initial metric, happy review
prompt, unhappy feedback, thank-you — now renders the Afraa-style
navy/cream layout with a curved-top white card, logo straddling the
boundary, and content fitting one mobile viewport.

## Public Review Page Architecture

### Routes
- `/j/{slug}` — journey-based flow (multi-screen: ask metric → branch
  to happy review prompt OR unhappy feedback → thank-you)
- `/f/{slug}` — legacy "deep" / truform single-screen (NPS / CSAT /
  CES / custom 1-10 → submit → thank-you)
- Both pages accept `?preview=true` for owner-side preview mode (engine
  drops `status='active'` filter and skips persistence).

### Branding resolution chain (`apps/api/src/surveys/branding.helper.ts`)
```
1. location.brandingLogoUrl / brandColor / displayName  (per-QR override)
2. workspace.brandingLogoUrl / brandColors.primary       (org default)
3. SYSTEM defaults (#2D5BFF / null / "Powered by rectangled.io")
```
Plus single-location fallthrough (hotfix-2): if `locationId` is null
on the journey but the workspace has exactly 1 location, fall through
to that location's branding. `displayName` is composed as
`"{workspace.name} — {location.name}"` when both differ.

White-label override: `organizations.white_label.enabled === true`
replaces `poweredByText` with `white_label.footerText`.

### `PublicBranding` shape (`packages/shared/src/types/branding.ts`)
```ts
interface PublicBranding {
  displayName: string       // never empty
  logoUrl: string | null    // null if no upload
  brandColor: string        // hex with leading #
  workspaceName: string     // raw, useful for {businessName} interpolation
  poweredByText: string     // default or white-labeled override
}
```

### Layout shell (`apps/web/src/components/public/branded-layout.tsx`)

Single design (no `?style=` switcher anymore as of hotfix-8). Structure:
- Top: navy `#11224f` header with concentric ring SVG from bottom-center.
  `minHeight: min(22vh, 180px)` mobile, `~32vh` sm:. Title is `displayName`.
- Bottom: white card with `border-top-radius: 50% 50px` curved top + tiled
  topographic wavy contour SVG. `flex-1` fills rest of viewport.
- Logo: 124px mobile / 152px sm: white circle with brand-color inner
  ring, straddling the boundary via `-translate-y-[62px]` mobile / `-[76px]`
  sm:. Image when `branding.logoUrl` set; cursive fallback otherwise
  (Cormorant Garamond italic 700, brand-colored).
- Cursive fallback source: split `displayName` on `" — "` and use the
  LOCATION half (after the dash). For "Pranav's Business — Woof Nest"
  → "woof" (first word of "Woof Nest"), not "pranav's".
- Footer: `branding.poweredByText`. If it equals
  `DEFAULT_POWERED_BY_TEXT`, render the rectangled.io speech-bubble
  brand mark + wordmark. Otherwise plain text (white-label).

### CSS var contract
Layout exposes these on the outer div via inline style:
- `--brand` — owner's brand color (logo border + buttons + selected states)
- `--navy` — `#11224f` shared header dark color
- `--gold` — `#d4af37` star outline color in CSAT-stars rendering

ALL descendant inner components read these via inline
`style={{ color: 'var(--navy)', backgroundColor: 'var(--brand)', ... }}`.
Don't introduce new dynamic colors via Tailwind arbitrary values
(`bg-[var(--brand)]`) — they purge unreliably on production. Inline
style works universally.

### Inner content design system (mobile-first)
Pattern used throughout `j/[slug]/page.tsx` and `f/[slug]/page.tsx`:
- Headings: `text-[20-22px] sm:text-[26-28px] font-extrabold leading-[1.15] tracking-tight`, color `var(--navy)`
- Sub-labels: `text-[10-11px] font-bold uppercase tracking-[0.22em]`, color `var(--navy)` opacity 0.55
- Scale buttons (NPS/CES/custom): `min-h-[40px] sm:min-h-[48px]` rounded-xl border-2; default white BG with navy border at 0.15 opacity; selected = brand BG + white text + box-shadow ring (`0 0 0 2px #fff, 0 0 0 4px brand`)
- CSAT stars: `size-9 sm:size-12` Lucide `<Star>`. Default stroke `var(--gold)`; hover/select fill `brandColor`
- Aspect chips: rounded-full border-2; default white/navy; selected brand/white
- Inputs (text/email/tel/textarea): `h-10 sm:h-12` rounded-xl border-2 with inline `onFocus`/`onBlur` to swap border to `var(--brand)`. We do NOT use shadcn `<Input>` here because the focus color needs to be brand-aware
- Primary buttons (Continue / Submit / YES): `h-12 sm:h-14` rounded-xl, brand BG, white text, font-bold
- Outline buttons (NO / cancel): h-11 / h-12, navy border at 0.18 opacity
- Celebration rings (thank-you, happy prompt): `mx-auto size-16 sm:size-20 rounded-full` with `backgroundColor: 'color-mix(in srgb, var(--brand) 15%, white)'`, contains `<CheckCircle2>` colored `var(--brand)`

### Spacing pattern
- Outer wrapper: `space-y-5 sm:space-y-7` (or `space-y-4 sm:space-y-5` for tighter sections)
- Internal: `space-y-2.5 sm:space-y-3` for stacks of small elements
- Padding tightens uniformly on mobile (e.g. white card `pt-20 sm:pt-24`)

## What's Pending (Open Items)

These are TODOs the user has expressed interest in but hasn't shipped.
Listed in rough priority order.

### 1. **R2 logo upload feature** — high priority, partially scoped
The user already created Cloudflare R2 bucket (`rectangleddotio`) and
generated an API token (Access Key ID + Secret Access Key). The
credentials were leaked in a screenshot during conversation; user
explicitly chose NOT to rotate them. Status:
- ❓ Env vars set in DigitalOcean App Platform `api` component? Last
  user message said "yeh le ab exact copy values de mujhe env k liye"
  — they planned to add them but never confirmed it's done. **Verify
  via `gh` or DO dashboard before writing the upload code.**
- Code NOT shipped yet. Need to add:
  - `apps/api/src/upload/r2.service.ts` — `@aws-sdk/client-s3`
    PUT/DELETE wrapped, signed URLs for direct browser → R2 upload
  - tRPC route on `location.update` and `workspace.update` to accept
    `logoUrl` after successful upload
  - Frontend UI on **Settings → Branding** (workspace) and
    **Locations → [id] → Branding** (per-location) to upload
  - Public page already handles `branding.logoUrl` — once it's set,
    the cursive fallback disappears automatically
- Env vars expected (from R2 dashboard):
  ```
  R2_ACCOUNT_ID=<...>
  R2_ACCESS_KEY_ID=<...>
  R2_SECRET_ACCESS_KEY=<...>
  R2_BUCKET=rectangleddotio
  R2_PUBLIC_URL=<custom-domain-or-r2.dev>
  ```

### 2. **Per-workspace navy header customization** — medium
`HEADER_NAVY` is hard-coded `#11224f` in `branded-layout.tsx`. Some
brands (especially those with dark brand colors) might clash. Plan:
- Add `headerColor` field to `PublicBranding` (default `#11224f`)
- Resolve in `branding.helper.ts` from `location.headerColor` →
  `workspace.headerColor` → default
- DB: add `header_color` column to `locations` and `workspaces`
- Settings UI: color picker
- Layout: read `branding.headerColor` instead of constant

### 3. **Per-workspace style picker** — low
The 4-style design switcher was removed in hotfix-8 in favor of the
single Afraa-replica. If the user later wants different styles per
workspace, restore the variants from git history (commit `471d5aa`)
behind a `branding.pageTheme` field.

### 4. **Inner content question copy** — low
Currently `MetricInput` shows just `screen.question` as the heading
+ tiny metric label below. Afraa's reference splits into two: a CTA
("Drop us a quick review!") + the actual prompt ("How was your dine
in experience?"). To match, either:
- Add a `screen.headerCopy` field to journey screens
- OR derive a generic CTA based on metric type and use `screen.question`
  as the sub
The user has not pushed on this — current single-line works.

### 5. **Public page locations subtitle** — low
The Stitch reference shows "DC Block Salt Lake City Centre - 1" as a
subtitle below the business name. Currently we only show
`branding.displayName` (the composed string). Adding a separate
`branding.locationSubtitle` field (location's address or short label)
would let us match more precisely.

### 6. **Skeleton + error states unbranded** — low
`FormSkeleton` and "Form Not Found" / "Journey Not Available" error
panels in `/j` and `/f` pages don't render through `BrandedPublicLayout`
— they show a generic centered card. Could brand them.

## Local Preview HTML

The user has a standalone preview file at:
```
C:\Users\Pranav\Downloads\rectangled-public-page-designs.html
```
Single big iPhone (420×880) showing the exact Afraa-style replica
with live controls (brand color, dark BG, cream BG, business name,
location, logo cursive, tagline, question, sub-question). Useful for
showing design changes to the user without waiting for DO redeploy.
**Update this file alongside any production design change** so the
preview stays in sync.

## Build / Verify Commands (cheat sheet)

```bash
# All from repo root unless noted
cd apps/web && npx tsc --noEmit               # ~14 baseline errors expected
cd apps/api && npx nest build                  # should be clean (0 errors)
cd packages/shared && npx tsc -p .             # should be clean
npx vitest run                                  # 111/111 should pass

# Format check (if needed)
npm run format

# Local dev (split terminals)
docker compose up -d
npm run dev --workspace=packages/db            # if changing schema
npm run dev --workspace=packages/shared        # if changing validators
npm run dev --workspace=apps/api               # NestJS hot reload (slow on Win)
npm run dev --workspace=apps/web               # Next.js hot reload
```

## Critical Don'ts (learned the hard way)

1. **Don't use `bg-[var(--brand)]`** — Tailwind arbitrary values purge
   unreliably for dynamic colors. Use inline `style={{ backgroundColor: 'var(--brand)' }}`.
2. **Don't use `ringColor` in CSS** — it's not a valid CSS property
   (Tailwind sugar). Use `boxShadow: '0 0 0 2px #fff, 0 0 0 4px <color>'`.
3. **Don't add the 4-style switcher back** — owner rejected it. One design.
4. **Don't change branding.helper.ts displayName format** — many places
   depend on the "Workspace — Location" composite. The cursive fallback
   logic in `branded-layout.tsx` already strips it.
5. **Don't break mobile-first sizing** — every text/spacing decision in
   the public pages is `mobile-value sm:desktop-value`. iPhone SE
   (375×667) is the constraint. Test in DevTools device emulation
   before pushing.
6. **Don't fix unrelated baseline TS errors** in the same commit as
   feature work — keep diffs scoped. The 11-14 baseline errors are
   pre-existing in escalations / listings / members / etc.
7. **Don't push to main without `npx vitest run` passing.** No CI yet.
8. **Don't rotate R2 credentials** without asking — user explicitly
   chose to leave them as-is despite the leak.

## User Preferences (Pranav)

- Hindi-English mix in conversation. Speaks fast, expects fast execution.
- Doesn't want over-explanation. Show the work, don't narrate it.
- "Bhata" / "bhai" frequent — friendly, not formal.
- Prefers code first, then explanation. "dont consume more tokens" if
  you're being verbose.
- Real business: **Woof Nest** — a dog grooming/pet care location
  under workspace "Pranav's Business". Single location workspace.
- Brand color preference: hot pink / vibrant; tries different colors
  via the preview HTML's color picker.
- Pushes hard on UX details: pixel-perfect alignment, mobile-fit,
  premium feel. Will reject "tatti" (cheap-looking) outputs.
- Time zone: IST. Working dates in May 2026 (per current date).
