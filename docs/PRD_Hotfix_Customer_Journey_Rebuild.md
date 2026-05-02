# PRD — Customer Journey Rebuild & Critical Hotfixes

**Project:** Rectangled.io OptimizerV6
**Version:** 1.0
**Date:** 2026-05-02
**Status:** Active hotfix — to be implemented before any further phase work
**Hand-to:** Claude Code

---

## 0. READ THIS FIRST (CLAUDE CODE — MANDATORY RULES)

You are Claude Code. This PRD fixes **6 critical issues** in the OptimizerV6 platform that are currently broken or missing. Read every section in full before writing any code.

### 0.1 Rules

1. **Do not invent file paths, table names, columns, or tRPC procedure names.** Every reference matches the existing codebase. If a file does not exist at a stated path, **stop and ask the user**.

2. **Do not break existing data.** All migrations are idempotent (running twice = same result as once). All existing surveys, responses, and customers must keep working.

3. **Diagnostic first, fix second.** Section 6 has SQL queries to run BEFORE writing fixes. Run them. Report output to the user. Do not skip.

4. **One PR per section.** Do not mix sections in one branch. Each is independently reviewable, deployable, revertable.

5. **No `drizzle-kit push` against production.** Use the migration discipline from Phase 0.

### 0.2 Existing context

- Stack: Next.js 15, NestJS + tRPC, Drizzle ORM, PostgreSQL 16, Recharts, React Flow
- Surveys table exists (`surveys`, `survey_responses`, `survey_starts`)
- Phase 3 merged old `journeys` + `truforms` into `surveys`
- Phase 5 dropped legacy `journeys` and `truforms` tables
- Public URLs `/j/{slug}` and `/f/{slug}` work via legacy compat shim
- React Flow canvas builder exists at `/dashboard/surveys/[id]` (this is currently broken UX — see §2)

### 0.3 Why this PRD exists

User reports:
- v2 Adaptive Journey was working, the merger broke it
- React Flow builder is too complex for SMB owners — "screens nahi ban rahe, logic nahi ban raha"
- QR scan public page shows no business name, no logo, no branding — looks generic
- Sidebar "Surveys" name is confusing — owners think of it as Customer Journey
- Chain Rollup page exists but overlaps heavily with Dashboard, owners don't know which to use
- **CRITICAL:** Customer responses might not be storing properly, or are storing but invisible in UI

---

## 1. EXECUTIVE SUMMARY OF FIXES

| # | Section | What it fixes | Priority |
|---|---|---|---|
| 1 | §2 — Adaptive Journey Restore | v2 adaptive flow broken by merger | P0 |
| 2 | §3 — Wizard Custom Journey Builder | React Flow canvas too complex | P0 |
| 3 | §4 — Location Branding on Public Pages | QR page shows no branding | P0 |
| 4 | §5 — Surveys → Customer Journeys Rename | Confusing nomenclature | P1 |
| 5 | §6 — Responses Storage & UI | Responses possibly not stored / not visible | P0 |
| 6 | §7 — Chain Rollup Merge into Dashboard | Two overlapping pages | P1 |

**Implementation order:** §6 (diagnostic) → §2 → §3 → §4 → §5 → §7

---

## 2. ADAPTIVE JOURNEY RESTORE (P0)

### 2.1 Problem

The v2 Adaptive Journey (random metric → threshold → happy/unhappy → review/aspect feedback) was working perfectly before Phase 3. The merger collapsed it into `template='quick', mode='intelligent'` and tried to express it as a generic step graph. Some logic was lost in translation. It's not working correctly anymore.

### 2.2 Solution

Add a fourth template value: `adaptive`.

```typescript
// packages/shared/src/types/survey.ts (or wherever the enum lives)
export const surveyTemplateEnum = pgEnum('survey_template', [
  'adaptive',  // ← NEW: locked v2 flow, hardcoded engine path
  'quick',     // existing
  'deep',      // existing
  'custom',    // ← NEW: manual wizard-built journey (see §3)
]);
```

### 2.3 Migration

`packages/db/migrations/0050_template_enum_extension.sql`:

```sql
-- Add new enum values (idempotent)
ALTER TYPE survey_template ADD VALUE IF NOT EXISTS 'adaptive';
ALTER TYPE survey_template ADD VALUE IF NOT EXISTS 'custom';

-- Migrate broken "quick intelligent" surveys back to adaptive
-- (these were the v2 adaptive journeys that got squeezed by the merger)
UPDATE surveys
SET template = 'adaptive'
WHERE template = 'quick'
  AND mode = 'intelligent';
```

After this migration, every previously-broken v2 journey will route through the new adaptive engine.

### 2.4 Adaptive engine

Create a **separate engine service** that handles `template='adaptive'` surveys. Do NOT use the step-based engine for adaptive surveys.

**File:** `apps/api/src/surveys/adaptive-engine.service.ts`

This engine implements the **exact v2 Adaptive Journey logic** (refer to `PRD_Adaptive_Customer_Journey_v2.md` for the locked spec):

1. Customer scans QR → loads `/j/{slug}`
2. Server picks ONE metric randomly from `survey.settings.enabledMetrics`
3. Customer answers that metric
4. Score evaluated against per-metric threshold:
   - CSAT ≥ 4 → happy
   - NPS ≥ 9 → happy
   - CES ≤ 3 → happy (inverted)
   - NEV ≥ 0 → happy
   - CLI ≥ 5 → happy
5. Happy path → "Will you leave a review on {platform}?" Yes/No
6. Unhappy path → aspect tag pills + optional text → contact collection (optional)
7. Store response, fire automation events, end

Settings shape for adaptive surveys:

```typescript
{
  enabledMetrics: ('csat' | 'nps' | 'ces' | 'nev' | 'cli')[],
  thresholds: { csat?, nps?, ces?, nev?, cli? }, // overrides defaults
  reviewPlatform: 'google' | 'zomato' | 'swiggy',
  reviewPlatformUrl: string,
  enableCoupon: boolean,
  couponTemplateId?: string,
  aspectTags: string[], // for unhappy path
  collectContact: boolean,
  collectContactRequired: boolean,
}
```

### 2.5 Engine routing

In the public flow handler, route by template:

```typescript
// apps/api/src/surveys/survey-engine.service.ts (or wherever public routing happens)
async getInitialState(input: { slug: string; sessionId?: string }) {
  const survey = await this.findBySlug(input.slug);

  if (survey.template === 'adaptive') {
    return this.adaptiveEngine.getInitialState(survey, input.sessionId);
  }

  // Existing step-based engine continues for quick/deep/custom
  return this.stepEngine.getInitialState(survey, input.sessionId);
}

async advance(input: AdvanceInput) {
  const survey = await this.findById(input.surveyId);

  if (survey.template === 'adaptive') {
    return this.adaptiveEngine.advance(survey, input);
  }

  return this.stepEngine.advance(survey, input);
}

async complete(input: CompleteInput) {
  const survey = await this.findById(input.surveyId);

  if (survey.template === 'adaptive') {
    return this.adaptiveEngine.complete(survey, input);
  }

  return this.stepEngine.complete(survey, input);
}
```

### 2.6 Builder UI

Adaptive surveys do NOT show the React Flow canvas. They show a **simple settings form**:

`apps/web/src/app/dashboard/journeys/[id]/page.tsx` (post-rename — see §5):

```
┌──────────────────────────────────────────────────────────┐
│  My Adaptive Journey                          [Save]    │
│  Adaptive · Active                            [QR] [URL] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Metrics to ask (random selection)                       │
│  ☑ CSAT (1-5 stars)                                     │
│  ☑ NPS (0-10 recommendation)                            │
│  ☐ CES (effort)                                         │
│  ☐ NEV (emotion)                                        │
│  ☐ CLI (loyalty)                                        │
│                                                          │
│  Thresholds (per metric)                                 │
│  CSAT happy if ≥ [4 ▼]                                  │
│  NPS  happy if ≥ [9 ▼]                                  │
│                                                          │
│  Happy path                                              │
│  Redirect to: [Google ▼]                                │
│  URL: [https://g.page/...]                              │
│                                                          │
│  Unhappy path                                            │
│  Aspect pills:                                           │
│    [Slow service] [Cold food] [Rude staff] [Pricing]   │
│    [+ Add aspect]                                       │
│  ☑ Collect contact (name + phone)                       │
│  ☐ Make contact required                                │
│  ☑ Issue coupon: [Template: SAVE20 ▼]                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Form fields map directly to `survey.settings`. No step graph, no canvas.

### 2.7 Tests

`apps/api/test/integration/adaptive-engine.spec.ts`:
- Random metric selection with single enabled metric → always picks that one
- Random metric selection with multiple → uniform distribution over 1000 sessions
- CSAT score 5 → routes happy
- CSAT score 2 → routes unhappy
- CES score 2 → routes happy (inverted)
- Happy path → redirect screen with Yes/No
- Unhappy path → aspects → contact → end
- Contact captured → customer upserted, customer_id linked on response

### 2.8 Done checklist

- [ ] `adaptive` and `custom` enum values added to `survey_template`
- [ ] Migration migrates broken quick-intelligent surveys → adaptive
- [ ] `adaptive-engine.service.ts` exists and implements v2 spec
- [ ] Engine routing in public handler routes by template
- [ ] Builder UI renders adaptive settings form (no React Flow)
- [ ] Public URL `/j/{slug}` for adaptive survey loads first metric correctly
- [ ] Smoke test: scan QR → CSAT → 5 stars → Google redirect screen → Yes → opens Google
- [ ] Smoke test: scan QR → CSAT → 2 stars → aspect pills → contact → end
- [ ] All tests green

---

## 3. WIZARD CUSTOM JOURNEY BUILDER (P0)

### 3.1 Problem

React Flow canvas at `/dashboard/surveys/[id]` is too complex for SMB owners. They cannot create screens, cannot connect logic, cannot understand branching. Per user: "screens nahi ban rahe, logic nahi ban raha aacha se."

### 3.2 Solution

Replace the React Flow canvas for `template='custom'` surveys with a **wizard + decision-tree editor**.

The React Flow canvas can stay for `template='quick'` and `template='deep'` if those templates are still in use. But for `custom`, owners NEVER see a canvas.

### 3.3 Create flow

When owner clicks "+ New Custom Journey" → opens a 4-question wizard. Modal-based, full-screen.

```
┌─────────────────────────────────────────────────────────┐
│  Create Custom Journey                            [✕]  │
│                                                        │
│  Step 1 of 4                                           │
│                                                        │
│  When customer scans the QR, what do you want         │
│  to ask first?                                         │
│                                                        │
│  ⚪ Their rating (1-5 stars / CSAT)                    │
│  ⚪ How likely they'd recommend us (NPS)               │
│  ⚪ How easy was their experience (CES)                │
│  ⚪ Let the system pick randomly (becomes Adaptive)    │
│                                                        │
│                                          [Continue →]  │
└─────────────────────────────────────────────────────────┘

  Step 2: When the customer is HAPPY, what should happen?
    ⚪ Redirect to Google review
    ⚪ Redirect to Zomato
    ⚪ Just thank them

  Step 3: When the customer is UNHAPPY, what should happen?
    ☑ Ask what went wrong (multi-select pills)
    ☑ Collect their contact for follow-up
    ☐ Ask them to type detailed feedback
    ☑ Issue a recovery coupon

  Step 4: What's the threshold for "happy"?
    ⚪ 4 or 5 stars
    ⚪ 5 stars only
    ⚪ Custom: [____]

  [← Back]    [Generate →]
```

**On Generate:** server creates a `custom` survey with a pre-built step graph based on the wizard answers. User redirected to the editor.

**Wizard option "Let the system pick randomly"** — instead of generating custom, this should just create a `template='adaptive'` survey using §2 logic. No need to build it as custom.

### 3.4 Editor UI — decision-tree mode (not canvas)

After wizard, owner lands on the editor. **No React Flow.** Pre-rendered decision tree with editable boxes.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to journeys                       [Save] [Activate]  │
├──────────────────────────────────────┬───────────────────────┤
│                                      │ EDIT STEP             │
│       ┌──────────────────────┐       │                       │
│       │ ⭐ Ask CSAT           │ ◀── click any box to edit  │
│       │ "How was your visit?"│       │                       │
│       └──────────┬───────────┘       │ Question:             │
│                  │                   │ [How was your visit? ]│
│         ┌────────┴────────┐          │                       │
│      HAPPY              UNHAPPY      │ Metric:               │
│      (≥4)                (≤3)        │ [⭐ CSAT 1-5      ▼]  │
│         │                  │         │                       │
│    ┌────▼─────┐       ┌───▼────┐    │ Threshold:            │
│    │🌐 Redirect│       │💬 Ask  │    │ Happy if ≥ [4]        │
│    │ Google   │       │aspects │    │                       │
│    └────┬─────┘       └───┬────┘    │ [+Insert step here]   │
│         │                 │         │                       │
│    ┌────▼─────┐       ┌───▼────┐    │ [🗑 Delete this step] │
│    │🏁 Thanks │       │📞 Get  │    │                       │
│    └──────────┘       │contact │    │                       │
│                       └───┬────┘    │                       │
│                           │         │                       │
│                       ┌───▼────┐    │                       │
│                       │🏁 End  │    │                       │
│                       └────────┘    │                       │
└──────────────────────────────────────┴───────────────────────┘
```

**Mechanics:**
- Tree is **pre-rendered** based on the survey's step graph
- Each box is **clickable** → opens edit panel on right
- **No drag-drop**. No edge dragging. No node reordering.
- Branching (HAPPY/UNHAPPY labels) is **rendered automatically** based on `branch_by_score` step config
- "+Insert step here" buttons appear on each edge — click to add a step inline

### 3.5 Insert step modal

Click "+Insert step here":

```
┌──────────────────────────────────────────┐
│  Insert a step here                 [✕]  │
├──────────────────────────────────────────┤
│  💬  Ask another question                │
│  ✋  Show a message screen               │
│  📞  Collect contact info                │
└──────────────────────────────────────────┘
```

Owner picks → step inserted in the right place → tree re-renders → owner edits content.

**Owner CANNOT add:** new metric ask (only one), new branch, new redirect, multiple ends. The structure is fixed by the wizard. Only content + simple insertions are editable.

For power users who want truly free-form journeys → use `template='quick'` or `template='deep'` with `mode='builder'` (existing React Flow canvas — keep it for them).

### 3.6 Phone preview

Top-right "📱 Preview" button:

```
┌─────────────────────────────────────────┐
│  Phone Preview                     [✕]  │
├─────────────────────────────────────────┤
│        ┌─────────────────────┐          │
│        │  Cafe Madras         │          │
│        │  How was your visit? │          │
│        │  ⭐ ⭐ ⭐ ⭐ ⭐         │          │
│        │  [Submit]            │          │
│        └─────────────────────┘          │
│   Step 1 of 6 · ◀ Prev · Next ▶        │
└─────────────────────────────────────────┘
```

Owner walks through the journey as a customer would. Tap-by-tap simulation. **Does NOT create a survey_starts row** (use `?preview=true` query param to bypass session insert).

### 3.7 Wizard → step graph mapping

Wizard answers map deterministically to a step graph stored in `survey.steps`:

**Step graph shape (typical custom journey from wizard):**

```json
[
  {
    "id": "s1",
    "type": "ask_metric",
    "config": {
      "metric": "csat",
      "question": "How was your visit today?"
    },
    "next": "s2"
  },
  {
    "id": "s2",
    "type": "branch_by_score",
    "config": {
      "metricFromStepId": "s1",
      "branches": [
        { "condition": { "op": "gte", "value": 4 }, "next": "s3_happy" }
      ],
      "default": "s3_unhappy"
    }
  },
  {
    "id": "s3_happy",
    "type": "redirect",
    "config": {
      "platform": "google",
      "url": "...",
      "yesLabel": "Sure",
      "noLabel": "Maybe later",
      "onYesNextStepId": "s_end_yes",
      "onNoNextStepId": "s_end_no"
    }
  },
  {
    "id": "s3_unhappy",
    "type": "ask_question",
    "config": {
      "fieldType": "multi_select",
      "question": "What went wrong?",
      "options": ["Slow service", "Cold food", "Rude staff"],
      "required": false
    },
    "next": "s4_contact"
  },
  {
    "id": "s4_contact",
    "type": "collect_contact",
    "config": {
      "fields": [
        { "key": "name", "required": false },
        { "key": "phone", "required": true }
      ]
    },
    "next": "s_end_unhappy"
  },
  { "id": "s_end_yes", "type": "end_journey", "config": { "message": "Thanks!" } },
  { "id": "s_end_no", "type": "end_journey", "config": { "message": "No worries!" } },
  {
    "id": "s_end_unhappy",
    "type": "end_journey",
    "config": {
      "message": "We'll fix it.",
      "issueCoupon": { "templateId": "tpl_xyz" }
    }
  }
]
```

This graph is parsed by the editor to render the decision tree visually. Same step engine as `quick`/`deep` runs it at runtime.

### 3.8 Helper: build step graph from wizard answers

`packages/shared/src/constants/survey-step-builders.ts`:

```typescript
export function buildCustomStepsFromWizard(answers: WizardAnswers): SurveyStep[] {
  // Maps wizard answers to a step graph
  // Same shape as buildQuickIntelligentSteps but parameterized by wizard
}
```

### 3.9 Validation

Before save, validate:
- All steps reachable from step[0]
- Every path ends at an `end_journey` step
- All `next` pointers reference existing step IDs
- Branch step has at least 1 condition + default
- No cycles (unless explicitly allowed — spec says no cycles in custom)

If validation fails → red banner: "This step is unreachable" / "This branch has no exit".

### 3.10 Done checklist

- [ ] Wizard modal with 4 questions
- [ ] Wizard maps to step graph via `buildCustomStepsFromWizard`
- [ ] Wizard "Random metric" option creates `template='adaptive'` instead of `custom`
- [ ] Editor for `custom` surveys renders decision tree (NOT React Flow)
- [ ] Click box → edit panel updates content
- [ ] "+Insert step here" inserts a step inline
- [ ] Phone preview walks through without creating survey_starts row
- [ ] Validation catches broken step graphs before save
- [ ] React Flow canvas stays for `quick`/`deep` builder mode (do not break existing)
- [ ] Smoke test: wizard → 4 answers → generate → preview → activate → scan QR → complete journey end to end

---

## 4. LOCATION BRANDING ON PUBLIC PAGES (P0)

### 4.1 Problem

QR scan landing page (`/j/{slug}`, `/f/{slug}`) shows no business name, no logo, no branding. Customer cannot tell what business this is feedback for. Old rectangled.io showed location logo + name on first screen and on every screen header.

### 4.2 Schema additions

`packages/db/migrations/0051_location_branding.sql`:

```sql
-- Idempotent column adds
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7),  -- hex like #2D5BFF
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
```

Drizzle schema update in `packages/db/src/schema/locations.ts`:

```typescript
logoUrl: text('logo_url'),
brandColor: varchar('brand_color', { length: 7 }),
displayName: varchar('display_name', { length: 255 }),
```

### 4.3 Resolution order

For any public page rendering branding:

```typescript
const branding = {
  displayName:
    location.displayName
    ?? `${workspace.name}${location.name ? ' — ' + location.name : ''}`,

  logoUrl:
    location.logoUrl
    ?? workspace.logoUrl  // existing column, verify it exists
    ?? null,

  brandColor:
    location.brandColor
    ?? workspace.settings?.brandColor
    ?? '#2D5BFF',  // system default
};
```

Verify `workspaces.logoUrl` exists. If not, add it the same way.

### 4.4 Public engine response

Public endpoints that serve QR pages must return a `branding` object:

```typescript
// apps/api/src/surveys/survey-engine.service.ts
async getInitialState({ slug, sessionId }: { slug: string; sessionId?: string }) {
  const survey = await this.findBySlug(slug);
  const workspace = await this.findWorkspace(survey.workspaceId);
  const location = survey.locationId ? await this.findLocation(survey.locationId) : null;
  const organization = await this.findOrganization(workspace.organizationId);

  const branding = {
    displayName: location?.displayName ?? `${workspace.name}${location ? ' — ' + location.name : ''}`,
    logoUrl: location?.logoUrl ?? workspace.logoUrl ?? null,
    brandColor: location?.brandColor ?? workspace.settings?.brandColor ?? '#2D5BFF',
    workspaceName: workspace.name,
    poweredByText: organization.whiteLabel?.enabled
      ? organization.whiteLabel.footerText
      : 'Powered by rectangled.io',
  };

  return {
    survey: { id, name, template, slug },
    branding,
    step: firstStep,
    sessionId,
  };
}
```

`advance` and `complete` endpoints should also return `branding` (so subsequent screens stay branded).

### 4.5 Public page UI

Frontend public page wraps every screen in a branded layout:

`apps/web/src/app/(public)/j/[slug]/PublicLayout.tsx`:

```tsx
export function PublicLayout({ branding, children }) {
  const cssVars = {
    '--brand': branding.brandColor,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col" style={cssVars}>
      <header
        className="bg-[var(--brand)] text-white p-4 flex items-center gap-3"
      >
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt=""
            className="h-12 w-12 rounded-md object-cover bg-white"
          />
        )}
        <h1 className="text-lg font-semibold">{branding.displayName}</h1>
      </header>

      <main className="flex-1 p-4">{children}</main>

      <footer className="text-xs text-gray-500 p-3 text-center border-t">
        {branding.poweredByText}
      </footer>
    </div>
  );
}
```

### 4.6 Settings UI — Location detail page

Location settings page (`/dashboard/locations/[id]/settings` or wherever) gets 3 new fields:

```
┌──────────────────────────────────────────────────────┐
│  Location: Bandra Branch                  [Save]    │
├──────────────────────────────────────────────────────┤
│  Display name (shown to customers on QR pages)      │
│  ┌────────────────────────────────────────────┐    │
│  │ Cafe Madras — Bandra                        │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Logo                                                │
│  ┌────────┐  [Upload new]  [Remove]                 │
│  │ [📷]   │  Recommended: square, 512x512px         │
│  └────────┘                                         │
│                                                      │
│  Brand color (header background)                     │
│  ┌────┐ ┌──────────┐                                │
│  │ ██ │ │ #2D5BFF  │                                │
│  └────┘ └──────────┘                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Logo uploads go to Cloudflare R2 (existing storage). Stored URL in `locations.logo_url`.

### 4.7 Onboarding additions

When adding a new location during onboarding, ask for these 3 fields. Provide "Use workspace logo / color" defaults so owners don't need to upload per location unless they want different branding.

### 4.8 Done checklist

- [ ] Migration adds `logo_url`, `brand_color`, `display_name` to `locations`
- [ ] Drizzle schema reflects new columns
- [ ] Public engine returns `branding` object in all 3 endpoints (initial / advance / complete)
- [ ] Public page renders branded header on every screen
- [ ] Brand color applies as header background
- [ ] Logo file uploads to R2 + URL stored
- [ ] Location settings page lets owner edit all 3 fields
- [ ] Onboarding flow lets owner set branding when adding location
- [ ] Workspace-level fallback works (logo/color from workspace if location not set)
- [ ] White-label override works for agency orgs
- [ ] Smoke test: scan QR → see logo + name + brand color → walk through journey, branding persists every screen

---

## 5. SURVEYS → "CUSTOMER JOURNEYS" RENAME (P1)

### 5.1 Problem

The product is called "Surveys" in UI, but owners think of it as their customer journey. Mismatch causes confusion. Old product was called "Customer Journey & TruForms" — owners are used to that vocabulary.

### 5.2 Scope — frontend only

**Backend table `surveys` stays.** Renaming a Postgres table that has 50+ FK references is operational risk for zero functional gain.

Only change:
- Sidebar label
- Page route
- Page title and breadcrumbs
- All user-facing strings ("survey" → "journey")
- API procedure names stay (`survey.list`, `survey.create`, etc.) — rename later if needed

### 5.3 File changes

| File | Change |
|---|---|
| `apps/web/src/components/dashboard/sidebar.tsx` | "Surveys" → "Customer Journeys" |
| `apps/web/src/app/dashboard/surveys/` | Move to `apps/web/src/app/dashboard/journeys/` |
| `apps/web/src/app/dashboard/journeys/page.tsx` | Title: "Customer Journeys" |
| `apps/web/src/app/dashboard/journeys/[id]/page.tsx` | Breadcrumb + title updated |
| All component strings | "survey" → "journey", "Survey" → "Journey" wherever user-facing |

### 5.4 URL redirect

To avoid breaking existing bookmarks:

```typescript
// apps/web/src/app/dashboard/surveys/page.tsx
import { redirect } from 'next/navigation';
export default function Page() {
  redirect('/dashboard/journeys');
}
// Same for /dashboard/surveys/[id]
```

### 5.5 Done checklist

- [ ] Sidebar shows "Customer Journeys"
- [ ] `/dashboard/journeys` renders the list
- [ ] `/dashboard/journeys/[id]` renders the editor
- [ ] `/dashboard/surveys` redirects to `/dashboard/journeys`
- [ ] `/dashboard/surveys/[id]` redirects to `/dashboard/journeys/[id]`
- [ ] All user-facing strings updated
- [ ] Backend `surveys` table and tRPC procedures unchanged
- [ ] No broken links anywhere in app

---

## 6. RESPONSES STORAGE & UI — DIAGNOSTIC + FIX (P0 — HIGHEST PRIORITY)

### 6.1 Problem

User reports: customer fills out a journey (e.g., gives name, phone, rates 5 stars) — but the brand cannot see the response anywhere. Either:
- (A) Data IS stored but no UI to view it
- (B) Data is stored but customer not linked, half-data visible
- (C) Data is NOT stored at all (engine broken)

### 6.2 STEP 0 — DIAGNOSTIC FIRST

**Before writing any fix, run these queries against production database. Report output to the user.**

**Query 1 — Are responses being stored?**

```sql
SELECT
  COUNT(*) AS total_responses,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed,
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS linked_to_customer,
  COUNT(*) FILTER (WHERE response_data IS NOT NULL AND response_data != '{}') AS has_data,
  MAX(created_at) AS most_recent
FROM survey_responses;
```

**Expected if healthy:** non-zero counts, recent timestamp.
**If 0 or stale:** engine is not writing — go to §6.3.

**Query 2 — Sample recent responses:**

```sql
SELECT
  sr.id,
  s.name AS journey_name,
  s.template,
  sr.metric_shown,
  sr.metric_score,
  sr.is_positive,
  sr.score,
  sr.answers,
  sr.response_data,
  sr.completed_at,
  sr.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.email AS customer_email
FROM survey_responses sr
LEFT JOIN surveys s ON s.id = sr.survey_id
LEFT JOIN customers c ON c.id = sr.customer_id
WHERE sr.completed_at IS NOT NULL
ORDER BY sr.created_at DESC
LIMIT 10;
```

**Cases:**
- Rows present, all fields populated → backend OK, UI is missing (§6.4)
- Rows present, `customer_id` NULL but `response_data` has name/phone → engine not upserting customer (§6.3)
- Rows missing or empty → engine not writing responses (§6.3)

**Query 3 — Customer upsert health:**

```sql
SELECT
  COUNT(*) AS total_customers,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) AS with_phone,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS with_email,
  COUNT(DISTINCT workspace_id) AS workspaces_with_customers,
  MAX(created_at) AS most_recent_customer
FROM customers
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Expected:** non-zero, recent.
**If zero:** customers not being created from journeys → engine bug.

### 6.3 Fix — Engine response storage (if Case B or C)

If diagnostic shows engine not writing properly:

**File:** `apps/api/src/surveys/adaptive-engine.service.ts` (and `step-engine.service.ts` if also broken)

The `complete()` method MUST do:

```typescript
async complete({ surveyId, sessionId, finalAnswers }: CompleteInput) {
  return await this.db.transaction(async (tx) => {
    // 1. Look up the start row
    const start = await tx.select().from(surveyStarts)
      .where(and(eq(surveyStarts.surveyId, surveyId), eq(surveyStarts.sessionId, sessionId)))
      .limit(1);

    if (!start.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session not found' });

    // 2. Upsert customer if contact info collected
    let customerId: string | null = null;
    const contactData = extractContactFromAnswers(finalAnswers);

    if (contactData.phone || contactData.email) {
      const existing = await tx.select().from(customers).where(and(
        eq(customers.workspaceId, survey.workspaceId),
        contactData.phone
          ? eq(customers.phone, contactData.phone)
          : eq(customers.email, contactData.email!),
      )).limit(1);

      if (existing.length) {
        customerId = existing[0].id;
        // Update if new data
        await tx.update(customers).set({
          name: contactData.name ?? existing[0].name,
          email: contactData.email ?? existing[0].email,
          phone: contactData.phone ?? existing[0].phone,
          updatedAt: new Date(),
        }).where(eq(customers.id, customerId));
      } else {
        const inserted = await tx.insert(customers).values({
          workspaceId: survey.workspaceId,
          locationId: survey.locationId,
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          source: 'journey',
        }).returning({ id: customers.id });
        customerId = inserted[0].id;
      }
    }

    // 3. Insert response
    const response = await tx.insert(surveyResponses).values({
      surveyId,
      workspaceId: survey.workspaceId,
      locationId: survey.locationId,
      organizationId: survey.organizationId,
      customerId,
      sessionId,
      metricShown: finalAnswers.metricShown,
      metricScore: finalAnswers.metricScore,
      isPositive: finalAnswers.isPositive,
      score: finalAnswers.score,
      answers: finalAnswers.answers,
      responseData: finalAnswers, // full payload for archival
      startedAt: start[0].startedAt,
      completedAt: new Date(),
      metadata: { ip, userAgent, source: 'qr' },
    }).returning();

    // 4. Mark start as completed
    await tx.update(surveyStarts)
      .set({ completedAt: new Date() })
      .where(eq(surveyStarts.id, start[0].id));

    // 5. Fire automation event
    await this.eventBus.emit({
      type: finalAnswers.isPositive ? 'journey.completed.positive' : 'journey.completed.negative',
      organizationId: survey.organizationId,
      workspaceId: survey.workspaceId,
      locationId: survey.locationId,
      payload: { surveyResponseId: response[0].id, customerId, score: finalAnswers.metricScore },
      idempotencyKey: `journey.completed:${response[0].id}`,
    });

    return { responseId: response[0].id, customerId };
  });
}
```

**Key points:**
- Wrapped in `db.transaction` — atomic
- Customer upsert by phone OR email (workspace-scoped)
- Full `responseData` stored as JSONB archival
- Hot-path columns (`metricShown`, `metricScore`, `isPositive`, `answers`) for fast queries
- `survey_starts.completedAt` updated to mark complete (closes abandonment gap)
- Event emitted for automation (Phase 4 event bus)

### 6.4 UI fix — Responses tab

Inside Customer Journey detail page (`/dashboard/journeys/[id]`), add a **Responses tab**.

```
┌─────────────────────────────────────────────────────────────┐
│  My Custom Journey                              [⋯ Menu]    │
│  Custom · Active · 247 responses                            │
├─────────────────────────────────────────────────────────────┤
│  [ Overview ] [ Builder ] [ Responses ] [ Settings ]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Filter: [All▼] [Happy] [Unhappy] [Last 7 days▼]           │
│  Search: [name / phone / email                          🔍] │
│                                                             │
│  Showing 247 responses · [Export CSV]                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🟢 Riya Sharma · +91 98XXX 12345                       │ │
│  │    CSAT: ⭐⭐⭐⭐⭐ (5/5) · Happy                       │ │
│  │    "Loved the food and service"                       │ │
│  │    May 2, 2:34pm · Bandra location · Google review ✓  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔴 Anonymous · No contact provided                     │ │
│  │    CSAT: ⭐⭐ (2/5) · Unhappy                          │ │
│  │    Aspects: Slow service, Cold food                   │ │
│  │    May 1, 7:12pm · Andheri location                   │ │
│  │    [Create escalation]                                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🟡 Rohan Patel · rohan@example.com                     │ │
│  │    CSAT: ⭐⭐⭐ (3/5) · Unhappy                        │ │
│  │    Aspects: Slow service                              │ │
│  │    "Took 30 min for water"                            │ │
│  │    May 1, 1:00pm · Bandra location                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Load more...                                               │
└─────────────────────────────────────────────────────────────┘
```

Color dot:
- 🟢 Happy / positive
- 🟡 Passive (CSAT 3, NPS 7-8, etc.)
- 🔴 Unhappy / negative

**Click any row → drawer opens with full detail:**

```
┌────────────────────────────────────────────────────────┐
│  Response Detail                                  [✕]  │
├────────────────────────────────────────────────────────┤
│  Riya Sharma                                           │
│  +91 98XXX 12345 · riya@example.com                    │
│  May 2, 2:34pm · Bandra location                       │
│                                                        │
│  Question: How was your visit today?                   │
│  Answer: ⭐⭐⭐⭐⭐ (5/5) — CSAT                        │
│                                                        │
│  Question: Will you leave a review on Google?          │
│  Answer: Yes                                           │
│                                                        │
│  Outcome: Happy path · Redirected to Google            │
│  Coupon issued: None                                   │
│                                                        │
│  ─────── Customer history ───────                      │
│  This is the customer's 2nd journey response.          │
│  [View customer profile →]                             │
│                                                        │
│  Actions:                                              │
│  [Send WhatsApp] [Issue coupon] [Tag customer]         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 6.5 New tRPC procedures

```typescript
// router: survey (or journey post-rename)
listResponses: query {
  surveyId,
  filter?: 'all' | 'happy' | 'unhappy',
  search?: string,
  dateFrom?: Date,
  dateTo?: Date,
  page?: number,
  limit?: number,
} → {
  responses: ResponseRow[],
  total: number,
}

getResponseById: query { id } → FullResponseDetail

exportResponsesCsv: mutation {
  surveyId,
  filter?,
  dateFrom?,
  dateTo?,
} → { downloadUrl }
```

### 6.6 Workspace-level All Responses page

Sidebar gets a new item: **"Responses"** (between Customer Journeys and Inbox).

`/dashboard/responses` — same UI as the per-journey Responses tab, but unfiltered by journey. Filter dropdown lets owner pick journey if they want.

```
Sidebar:
  Dashboard
  Customer Journeys
▸ Responses          ← NEW
  Inbox
  Escalations
  Customers
```

### 6.7 Done checklist

- [ ] Diagnostic queries run, output shared with user
- [ ] Engine writes to `survey_responses` atomically (wrapped in transaction)
- [ ] Customer upsert works (phone or email match within workspace)
- [ ] `customer_id` populated on response when contact provided
- [ ] `responseData` JSONB has full payload
- [ ] `survey_starts.completedAt` set on completion
- [ ] Event emitted for automation
- [ ] Per-journey Responses tab renders all responses
- [ ] Filter by happy/unhappy/date works
- [ ] Search by name/phone/email works
- [ ] Click row → detail drawer opens with full breakdown
- [ ] Workspace-level `/dashboard/responses` page exists
- [ ] Export CSV works
- [ ] Smoke test: scan QR → fill journey with name + phone + 5 stars → response visible in Responses tab within 5 seconds → customer record exists in Customers list

---

## 7. CHAIN ROLLUP MERGE INTO DASHBOARD (P1)

### 7.1 Problem

`/dashboard/chain` page exists with 90% data overlap with `/dashboard/overview` (Dashboard). Owners don't know which to use.

Per user: "to dashboard and isme kya difference reh jayega?"

### 7.2 Solution

**Delete `/dashboard/chain`. Move its useful widgets into the existing Dashboard, scoped to current workspace.**

Sidebar item "Chain rollup" → removed.
Single Dashboard remains. Multi-location workspaces see additional widgets automatically.

### 7.3 Scope correction

Current chain rollup is **organization-scoped**. This is wrong. It should be **workspace-scoped**:

> Workspace = one brand. Brand has multiple locations. Chain view shows all locations of THAT brand.
>
> Agency with 5 client brands = 5 workspaces. Each workspace has its own chain view via the Dashboard. Cross-brand mixing is forbidden.

All chain endpoints take `workspaceId`, not `organizationId`:

```typescript
// BEFORE (broken — agency mixes brands):
chain.getOverviewKpis({ organizationId, dateFrom, dateTo })

// AFTER (correct — single brand):
chain.getOverviewKpis({ workspaceId, dateFrom, dateTo, locationIds? })
chain.getLocationLeaderboard({ workspaceId, ... })
chain.getRatingTrendsByLocation({ workspaceId, ... })
chain.getGeoDistribution({ workspaceId, ... })
```

Existing endpoints: refactor input from `organizationId` → `workspaceId`. Service layer queries already filter by workspace internally — just unwire the org-level join and require workspace.

### 7.4 Dashboard layout — single page

`/dashboard/overview`:

```
┌─────────────────────────────────────────────────────────────┐
│  Cafe Madras Dashboard               [Last 30 days▼]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  KPI strip (workspace totals)                               │
│  Reviews · Avg Rating · Response % · Open Esc · NPS · NEV  │
│                                                             │
│  Review trends · Sentiment composition · Rating dist        │
│                                                             │
│  Recent activity feed                                       │
│                                                             │
│  ─────────────────────────────────────────                  │
│                                                             │
│  🏢 By Location                                             │
│  (only renders when workspace.locationCount >= 2)           │
│                                                             │
│  Filter locations: [All locations ▼]                        │
│                                                             │
│  Locations leaderboard (sortable)                           │
│   Branch     │Reviews│ ★  │Rspns%│Open│SLA%                │
│   ──────────┼───────┼────┼──────┼────┼─────                │
│   Bandra    │  120  │4.6 │ 92%  │ 0  │ 0%                  │
│   Andheri   │   95  │3.2 │ 50%  │ 8  │ 35% ← red flag      │
│   Powai     │   72  │4.5 │ 88%  │ 0  │ 0%                  │
│                                                             │
│  Per-location rating trends (multi-line chart)              │
│                                                             │
│  Geo distribution (cities grouped)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Conditional rendering

```tsx
// apps/web/src/app/dashboard/overview/page.tsx
const showByLocation = currentWorkspace.locationCount >= 2;

return (
  <Dashboard>
    <KpiStrip />
    <Trends />
    <RecentActivity />
    {showByLocation && (
      <>
        <Divider title="By Location" icon={<Building2 />} />
        <LocationFilter />
        <LocationsLeaderboard workspaceId={...} />
        <PerLocationTrends workspaceId={...} />
        <GeoDistribution workspaceId={...} />
      </>
    )}
  </Dashboard>
);
```

Single-location workspaces → "By Location" section is hidden entirely. No clutter.

### 7.6 Location filter

Top of "By Location" section, a dropdown:

```
Filter locations:
┌─────────────────────────────────┐
│ ☑ All 12 locations              │
│ ─────────────────               │
│ ☐ Bandra                        │
│ ☐ Vasant Kunj                   │
│ ☐ Andheri                       │
│ ☐ ...                           │
└─────────────────────────────────┘
```

If owner picks one location → leaderboard shows just that row, trends chart shows just that line, geo grouping unchanged. Drill-down without leaving the page.

### 7.7 Sidebar removal

`apps/web/src/components/dashboard/sidebar.tsx`:
- Remove "Chain rollup" / "Chain Overview" item
- Keep Dashboard as single overview entry point

### 7.8 Page deletion

- Delete `apps/web/src/app/dashboard/chain/page.tsx`
- Add redirect: `/dashboard/chain` → `/dashboard/overview` (preserves bookmarks)

### 7.9 Endpoint signature migration

```typescript
// packages/shared/src/validators/chain.ts
// Before:
export const getOverviewKpisInput = z.object({
  organizationId: z.string().uuid(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});
// After:
export const getOverviewKpisInput = z.object({
  workspaceId: z.string().uuid(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  locationIds: z.array(z.string().uuid()).optional(),
});
```

Service layer in `apps/api/src/chain/chain.service.ts`:
- Replace `WHERE workspaces.organization_id = $1` with `WHERE workspaces.id = $1`
- All joins on `locations.workspace_id = workspaces.id`
- If `locationIds` provided, add `AND locations.id = ANY($2::uuid[])`

### 7.10 Done checklist

- [ ] `/dashboard/chain` page deleted
- [ ] `/dashboard/chain` redirects to `/dashboard/overview`
- [ ] Sidebar "Chain rollup" removed
- [ ] Dashboard renders "By Location" section conditionally (locationCount >= 2)
- [ ] Location filter dropdown works
- [ ] All chain endpoints take `workspaceId` instead of `organizationId`
- [ ] Service-layer queries filter by workspace, not org
- [ ] Single-location workspace → no "By Location" section visible
- [ ] Multi-location workspace → leaderboard + trends + geo all render
- [ ] Smoke test: switch between two workspaces in agency org → each shows only its own locations

---

## 8. TESTING REQUIREMENTS

### 8.1 Unit tests

Per section:
- §2: Adaptive engine random metric distribution + threshold routing per metric
- §3: Wizard answers → step graph mapping is deterministic
- §4: Branding resolution order (location → workspace → default)
- §6: Customer upsert by phone/email; transaction rollback on insert failure
- §7: Workspace scope correctly filters cross-workspace data

### 8.2 Integration tests

`apps/api/test/integration/`:
- `adaptive-flow.spec.ts` — full v2 flow end-to-end
- `wizard-custom.spec.ts` — wizard input → custom survey → public completion
- `branding-public.spec.ts` — branding object returned correctly with fallbacks
- `responses-storage.spec.ts` — complete journey → response row + customer + event all written atomically
- `dashboard-by-location.spec.ts` — workspace with 2 locations renders both, single-location hides section

### 8.3 E2E tests (Playwright)

- Owner creates adaptive journey → scans own QR → completes → sees response in Responses tab within 5s
- Owner creates custom journey via wizard → preview → activate → scans QR → completes → response stored
- Multi-location workspace dashboard → leaderboard sortable → click row → drills correctly

### 8.4 Manual smoke checklist

User to perform after all sections shipped:

- [ ] Scan QR for adaptive journey → metric appears → 5 stars → Google redirect → end → response in Responses tab
- [ ] Scan QR for adaptive journey → 2 stars → aspects → contact → end → response in Responses tab + customer in Customers list
- [ ] Create custom journey via wizard → preview → activate → scan → complete → response stored
- [ ] QR scan page shows location logo + name + brand color
- [ ] Sidebar shows "Customer Journeys" not "Surveys"
- [ ] `/dashboard/chain` redirects to `/dashboard/overview`
- [ ] Multi-location workspace dashboard shows "By Location" section
- [ ] Single-location workspace dashboard does NOT show "By Location" section
- [ ] Switch workspaces in agency org → each shows only its own locations

---

## 9. IMPLEMENTATION ORDER

Execute sections in this order. Do not skip ahead.

```
Day 1-2:    §6 STEP 0 — Diagnostic queries, share output with user
Day 3-5:    §6 — Engine fix (if needed) + Responses tab UI
Day 6-9:    §2 — Adaptive Journey restore
Day 10-15:  §3 — Wizard Custom Journey builder
Day 16-18:  §4 — Location branding on public pages
Day 19-20:  §5 — Surveys → Customer Journeys rename
Day 21-23:  §7 — Chain Rollup merge into Dashboard
Day 24:     End-to-end smoke test
```

Total: ~24 days (~5 weeks).

---

## 10. WHAT "DONE" LOOKS LIKE

After all 6 sections shipped, the following user journeys must work:

**Direct SMB owner (single location):**
1. Logs in → sees Dashboard with workspace KPIs
2. Creates a Custom Journey via 4-question wizard → activated in 30 seconds
3. Scans own QR → sees branded landing page with own logo + name
4. Customer scans QR → completes journey → response stored
5. Owner opens Customer Journey → Responses tab → sees customer's name, phone, score
6. Sidebar has: Dashboard, Customer Journeys, Responses, Inbox, Escalations, Customers

**Multi-location chain owner:**
1. Logs in → Dashboard → KPI strip + "By Location" section with leaderboard
2. Spots Andheri branch with 8 open escalations / 35% SLA breach
3. Filters to Andheri location → all widgets re-scope
4. Drills into Andheri specifically (existing per-location dashboard)
5. Same Customer Journey creation flow
6. Each location's QR shows that location's branding

**Agency manager (multi-brand):**
1. Switches workspace from Brand A to Brand B
2. Each workspace shows its own KPIs, own locations, own journeys, own responses
3. No cross-brand data leak

---

**END OF PRD**

Hand to Claude Code. Start with §6 diagnostic. No skipping. No mixing sections.
