# Hotfix PRD §4 — Location Branding on Public Pages

**Status:** Complete (schema + plumbing + render). Settings UI + onboarding + R2 upload deferred.
**Migrations applied:** 0021 (3 columns added to `locations`).
**Tests:** 111 vitest + 14/14 §3 smoke (backwards-compat after engine relaxation) + verify-section4-branding script (3/3 templates resolve cleanly against prod).
**Source spec:** `docs/PRD_Hotfix_Customer_Journey_Rebuild.md` § 4.

---

## TL;DR

QR-scan landing pages (`/j/{slug}`, `/f/{slug}`) used to be unbranded — no logo, no business name, no brand color. Customers couldn't tell what business they were giving feedback to. This hotfix:

1. Adds 3 optional columns to `locations` (`logo_url`, `brand_color`, `display_name`).
2. Adds a single resolution helper (`resolvePublicBranding`) with a 3-tier fallback: location overrides → workspace defaults (`logo_url`, `brand_colors.primary`) → system defaults (`#2D5BFF`, "Powered by rectangled.io").
3. Threads the resolved `branding` object through every public GET endpoint (`getPublicLegacyJourney`, `getPublicLegacyTruform`, adaptive `getInitialState`).
4. Wraps both renderer pages in a new `BrandedPublicLayout` that paints a logo + display name on a brand-colored header, keeps the existing card-style content in the middle, and renders a white-label-aware footer.
5. Honors `organizations.white_label.enabled` for the footer override (already-existing column, no schema change needed).

Submit endpoints **don't** re-emit branding — the renderer fetches once on mount and holds in React state. Branding can't change mid-session, so this keeps the diff small without losing UX.

---

## What shipped

### Schema (`scripts/migrations/0021_location_branding.sql`)

```sql
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS logo_url     TEXT,
  ADD COLUMN IF NOT EXISTS brand_color  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
```

Idempotent. Re-applying is a no-op once landed.

`packages/db/src/schema/locations.ts` reflects the same three new optional columns:

```typescript
logoUrl: text('logo_url'),
brandColor: varchar('brand_color', { length: 7 }),
displayName: varchar('display_name', { length: 255 }),
```

### Branding type (`packages/shared/src/types/branding.ts`) *(NEW)*

```typescript
export interface PublicBranding {
  displayName: string         // non-empty
  logoUrl: string | null
  brandColor: string          // non-empty hex (default #2D5BFF)
  workspaceName: string       // raw workspace.name (for {businessName} interpolation)
  poweredByText: string       // "Powered by rectangled.io" or white-label override
}

export const DEFAULT_BRAND_COLOR = '#2D5BFF'
export const DEFAULT_POWERED_BY_TEXT = 'Powered by rectangled.io'
```

Lives in `@rectangled/shared` so the renderer can type its consumption directly without touching server-side types.

### Resolution helper (`apps/api/src/surveys/branding.helper.ts`) *(NEW)*

`resolvePublicBranding(db, workspaceId, locationId)` is the single source of truth for the 3-tier fallback. Reads workspace + location in parallel; reads organization separately. Composition rules:

| Field | Resolution order |
|---|---|
| `displayName` | `location.display_name` → `${workspace.name} — ${location.name}` (when location set) → `workspace.name` |
| `logoUrl` | `location.logo_url` → `workspace.logo_url` → `null` |
| `brandColor` | `location.brand_color` → `workspace.brand_colors.primary` → `'#2D5BFF'` |
| `workspaceName` | `workspace.name` (always) |
| `poweredByText` | `organization.white_label.footerText` (only when `white_label.enabled === true`) → `'Powered by rectangled.io'` |

**Decision note:** PRD §4.3 referenced `workspace.settings?.brandColor`. We use `workspace.brand_colors.primary` instead because that's the dedicated typed jsonb column already in the schema (`{primary, secondary, accent}`). Reduces "where does brand color live?" ambiguity to a single canonical place.

### Engine integration

- **`apps/api/src/surveys/survey-engine.service.ts`**:
  - `getPublicLegacyJourney`: resolves branding once at the top, passes through to `legacyShapeFromAdaptive` (for adaptive surveys) and includes in the returned `LegacyJourneyShape` (for quick/custom).
  - `getPublicLegacyTruform`: resolves branding, includes in returned `LegacyTruformShape`.
  - `LegacyJourneyShape` and `LegacyTruformShape` interfaces now include `branding: PublicBranding`.

- **`apps/api/src/surveys/adaptive-engine.service.ts`**:
  - `getInitialState`: replaces the old `resolveBusinessName` private call with `resolvePublicBranding` + reads `branding.workspaceName` to keep the existing `businessName` field. Includes the full `branding` object in the response.
  - `AdaptiveInitialState` interface gains `branding: PublicBranding`.

Submit endpoints (`submitLegacyJourney`, `submitLegacyTruform`, `advance`, `complete`) deliberately **do not** include branding — the renderer holds it in React state across the flow.

### Public renderer wiring

- **`apps/web/src/components/public/branded-layout.tsx`** *(NEW)*:
  - `<BrandedPublicLayout branding={...} topSlot={...}>` — wraps every screen.
  - Header paints `branding.logoUrl` (or a letter-tile fallback) on `branding.brandColor` with the display name.
  - Footer renders `branding.poweredByText`.
  - Brand color exposed as a CSS custom property `--brand` so descendant components can reference it without prop-drilling.
  - `topSlot` accepts arbitrary content above the header — used by `/j/[slug]` for the §3 preview banner.

- **`apps/web/src/app/j/[slug]/page.tsx`**:
  - Imports `BrandedPublicLayout` + `PublicBranding` type.
  - Adds `branding: PublicBranding` to the journey query type.
  - Replaces the outer `<div min-h-screen ...>` wrapper with `<BrandedPublicLayout branding={journey.branding} topSlot={isPreview && <PreviewBanner/>}>`.
  - Removes the old generic "Powered by rectangled.io" footer (now inside the layout).

- **`apps/web/src/app/f/[slug]/page.tsx`**:
  - Imports `BrandedPublicLayout` + `PublicBranding` type.
  - Reads brand color from `branding.brandColor` (location-resolved) instead of `form.config?.brandColor` (per-survey legacy).
  - Wraps the success state and the main form Card in `BrandedPublicLayout`.
  - Removes the old "Brand bar" stripe + the per-card "Powered by" line (the layout's header + footer subsume both).
  - Keeps `<h1>{form.name}</h1>` inside the Card — the branded header shows the BUSINESS name; the form's `<h1>` shows the SURVEY name (e.g. "NPS Q4 2025"). Different concepts.

### Verification (`scripts/verify-section4-branding.mjs`) *(NEW)*

One-shot diagnostic that calls the public GET endpoints for one survey of each template and dumps the resolved branding payload. Read-only, safe to run anytime. Sample run against prod:

```
[quick] test 6  (slug=j-e91a78f8-a)
  branding:
    displayName: "Pranav's Business"        ← workspace.name fallback (no location)
    logoUrl: null                           ← no workspace logo configured yet
    brandColor: "#2D5BFF"                   ← system default
    workspaceName: "Pranav's Business"
    poweredByText: "Powered by rectangled.io"
  ✓ all 5 branding fields present

[deep] Custom Feedback Form  (slug=custom-feedback-1058)
  branding:
    displayName: "Spice Garden Restaurant — Spice Garden - Koramangala"  ← composed
    logoUrl: null
    brandColor: "#2D5BFF"
    workspaceName: "Spice Garden Restaurant"
    poweredByText: "Powered by rectangled.io"

[adaptive] Test 1  (slug=j-86002d80-1)
  branding:
    displayName: "Pranav's Business — Woof Nest"
    ...
```

All three templates resolve cleanly. Field cascade works as designed.

---

## Production state after §4

| Tier | Field | Population |
|---|---|---:|
| Location | `logo_url` / `brand_color` / `display_name` | 0 of 4 (settings UI deferred) |
| Workspace | `logo_url` | 0 of N (none uploaded yet) |
| Workspace | `brand_colors.primary` | 0 of N |
| Organization | `white_label.enabled` | 0 of 2 (no white-label customers) |

Every public page currently renders with: workspace.name as displayName (or `name — locationName` when bound), no logo (letter-tile placeholder), `#2D5BFF` brand color, default tagline. Owners get a visible improvement immediately on the next deploy; richer branding lights up as the settings UI lands and they upload logos / pick colors.

---

## Out of scope (follow-up commits)

- **§4.6 — Per-location settings UI** (`/dashboard/locations/[id]/settings`): owners need a way to set the 3 fields without SQL. Plan: extend the existing `/dashboard/locations/page.tsx` (currently a list view) with edit panels.
- **§4.7 — Onboarding additions**: ask for branding when adding a new location during onboarding, with "Use workspace logo / color" defaults.
- **R2 logo upload helper**: today the URL field is text-only; owners host their logo elsewhere. Future: file picker that uploads to R2 + populates the URL field.

These three items can ship as one small follow-up PR (settings UI + onboarding + R2 upload all hit the same page) once core §4 is in.

---

## What "done" looks like (per PRD §4.8)

- [x] Migration adds `logo_url`, `brand_color`, `display_name` to `locations`
- [x] Drizzle schema reflects new columns
- [x] Public engine returns `branding` object in GET endpoints (initial)
- [x] Public page renders branded header on every screen
- [x] Brand color applies as header background
- [ ] Logo file uploads to R2 + URL stored *(deferred — URL paste only for now)*
- [ ] Location settings page lets owner edit all 3 fields *(deferred)*
- [ ] Onboarding flow lets owner set branding when adding location *(deferred)*
- [x] Workspace-level fallback works (logo/color from workspace if location not set)
- [x] White-label override works for agency orgs (`organizations.white_label`)
- [x] Smoke test: getPublicLegacyJourney + getPublicLegacyTruform return well-formed branding for all 3 active templates against prod (see `verify-section4-branding.mjs`)

---

## Pointers

- Branding type:        `packages/shared/src/types/branding.ts`
- Resolution helper:    `apps/api/src/surveys/branding.helper.ts`
- Engine integration:   `apps/api/src/surveys/survey-engine.service.ts` + `adaptive-engine.service.ts`
- Public layout:        `apps/web/src/components/public/branded-layout.tsx`
- Renderers:            `apps/web/src/app/j/[slug]/page.tsx`, `apps/web/src/app/f/[slug]/page.tsx`
- Migration:            `scripts/migrations/0021_location_branding.sql`
- Diagnostic / verify:  `scripts/diagnose-section4-preflight.mjs`, `scripts/verify-section4-branding.mjs`
- Source spec:          `docs/PRD_Hotfix_Customer_Journey_Rebuild.md` §4
