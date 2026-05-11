---
type: concept
aliases: [Customer Journeys, Customer Flows, Journey Map]
---

# Customer Journeys — Every Flow + Data Dependencies

Every customer-facing flow in the product, with what data is collected, which module owns it, and what fires downstream.

Two public routes, four templates, five metrics, branching graphs.

## The two public surfaces

| Route | Template values it serves | UX shape |
|---|---|---|
| `/j/[slug]` | `quick`, `adaptive`, `custom` | Multi-screen branching |
| `/f/[slug]` | `deep` | Multi-screen branching (was single-screen pre-Path B) |

Both are unauthenticated. Both delegate to the shared `SurveyEngineRenderer` (see [[Public-Pages]]) which walks the survey step graph one step at a time via `trpc.survey.getInitialState` → `advance` → `complete`. Both resolve branding through `branding.helper.ts` (see [[Branding-Resolution]]).

> **Status (post commits `1524fb6` Path B + `ce89a82` state reset + `1a013e6` refs fix):** the decision-tree editor's graph drives customer-facing walks end-to-end. Every branch routes correctly server-side; every per-step answer + contact data persists. Live-verified across detractor / else / promoter branches on a freshly-built deep survey — see [[Hotfix-Trail]] for the chain.

---

## Journey A · Adaptive Journey (`/j/[slug]`)

```
QR scan / WhatsApp link / Email link
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ STEP 1 — Page load (asking_metric)                   │
│ FE: apps/web/src/app/j/[slug]/page.tsx                │
│ Calls: trpc.survey.getPublicLegacyJourney             │
│ API:  apps/api/src/surveys/survey-engine.service.ts   │
│   - looks up survey by slug                           │
│   - filters status='active' (unless ?preview=true)    │
│   - calls branding.helper.ts (Locations → Workspaces  │
│     → defaults; single-location fall-through)         │
│   - server picks a RANDOM metric from settings        │
│     .enabledMetrics: CSAT/NPS/CES/NEV/CLI             │
│   - seeds screen copy from journey-metrics.ts         │
│     (question, scaleLabels, aspectTags, reviewPrompt, │
│     reviewTemplate, redirectLinks{google|zomato|      │
│     swiggy}, thankYou variants)                       │
│ Modules touched: [[Surveys]] · [[Workspaces]] ·       │
│   [[Locations]] · [[Organization]] ·                  │
│   [[Business-Aspects]] (aspectTags) ·                 │
│   [[Branding-Resolution]]                             │
└─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ STEP 2 — Customer submits a metric score              │
│ Data sent: { metricShown, metricScore, sessionId,     │
│             journeyId, journeyScreenId, locationId,   │
│             preview }                                 │
│ Score ranges (from journey-metrics.ts):               │
│   CSAT  1–5      threshold ≥ 4                        │
│   NPS   0–10     threshold ≥ 9                        │
│   CES   1–7      threshold ≤ 3   (INVERTED)           │
│   NEV  −100..100 threshold ≥ 0                        │
│   CLI   1–7      threshold ≥ 5                        │
│ API writes:                                           │
│   - INSERT survey_starts (workspace, survey, session) │
│   - INSERT survey_responses (workspace, location,     │
│     survey, sessionId, metric, score, started_at)     │
│ API decides: isPositive = score crosses threshold     │
│ Returns: { responseId, isPositive }                   │
│ Modules touched: [[Surveys]]                          │
└─────────────────────────────────────────────────────┘
                │
        ┌───────┴────────┐
   isPositive=true   isPositive=false
        │                │
        ▼                ▼
┌────────────────┐   ┌──────────────────────────────────┐
│ STEP 3a —      │   │ STEP 3b — Unhappy branch          │
│ Happy prompt   │   │                                   │
│                │   │ Customer fills:                   │
│ "Would you     │   │   - aspectTags[] (multi-select    │
│ mind leaving   │   │     from [[Business-Aspects]],    │
│ a review?"     │   │     seeded per industry in        │
│                │   │     [[Onboarding]])               │
│  YES → 3a.1    │   │   - feedback (free text)          │
│  NO  → 3a.2    │   │   - OPTIONAL: name, phone, email  │
└────────────────┘   │                                   │
        │            │ Data sent: { updateResponseId,    │
        │            │   responseData: { aspectTags,     │
        │            │   feedback }, customerName,       │
        │            │   customerEmail, customerPhone }  │
        │            │                                   │
        │            │ API writes:                       │
        │            │   - UPDATE survey_responses with  │
        │            │     aspectTags + feedback         │
        │            │   - UPSERT into customers (fuzzy  │
        │            │     match on phone/email within   │
        │            │     workspace) if contact present │
        │            │   - cx-routing: evaluate          │
        │            │     escalation rules → maybe      │
        │            │     INSERT cx_escalations         │
        │            │   - nev: classify emotion vector  │
        │            │     from feedback text via        │
        │            │     [[OpenRouter]]                │
        │            │   - cli: recompute loyalty index  │
        │            │   - automation: fire rules        │
        │            │     matching "low-rating survey   │
        │            │     response" trigger             │
        │            │   - notification: fan-out to      │
        │            │     assignee + bell icon          │
        │            │   - email/wapisnap: optional      │
        │            │     outbound message              │
        │            │                                   │
        │            │ Modules: [[Surveys]] ·            │
        │            │   [[Customers]] · [[Escalations]] │
        │            │   · [[NEV]] · [[CLI]] ·           │
        │            │   [[Automations]] ·               │
        │            │   [[Notifications]] ·             │
        │            │   [[Business-Aspects]] ·          │
        │            │   [[Email]] · [[WapiSnap]] ·      │
        │            │   [[OpenRouter]]                  │
        │            └──────────────────────────────────┘
        │                              │
        ▼                              │
┌─────────────────────────────────┐    │
│ STEP 3a.1 — Happy YES (TERMINAL) │    │
│                                  │    │
│ Spec:                            │    │
│  - FE copies an AI-GENERATED     │    │
│    review draft to the user's    │    │
│    clipboard. The text is        │    │
│    composed server-side per      │    │
│    business + the positive       │    │
│    context the customer just     │    │
│    expressed; it is NOT the      │    │
│    static `reviewTemplate`       │    │
│    default in journey-metrics.ts │    │
│  - FE opens redirectURL in a NEW │    │
│    tab (Google / Zomato / Swiggy │    │
│    / etc. per platform settings).│    │
│  - **Journey A ENDS HERE.** The  │    │
│    customer is now outside       │    │
│    rectangled.io's environment.  │    │
│    What happens next (paste,     │    │
│    post, abandon) is unobservable│    │
│    from this side.               │    │
│                                  │    │
│ Data we keep: just the click.    │    │
│   { updateResponseId,            │    │
│     responseData:                │    │
│       { acceptedReviewPrompt:    │    │
│         true, redirectedTo } }   │    │
│ API: UPDATE survey_responses     │    │
│   (records ONLY that YES was     │    │
│    clicked + which platform)     │    │
│                                  │    │
│ Status: SHIPPED — see           │    │
│   apps/api/src/surveys/          │    │
│   survey-engine.service.ts       │    │
│   `generateHappyReviewDraft` +   │    │
│   `trpc.survey.generate          │    │
│   HappyReviewDraft` mutation.    │    │
│   FE calls it before clipboard   │    │
│   write; falls back to static    │    │
│   template if OpenRouter fails.  │    │
│                                  │    │
│ External-review loopback is a    │    │
│ SEPARATE flow → see Journey E.   │    │
└─────────────────────────────────┘    │
        │                              │
        ▼                              │
┌─────────────────────────────────┐    │
│ STEP 3a.2 — Happy NO (TERMINAL)  │    │
│ Data: { acceptedReviewPrompt:   │    │
│   false }                       │    │
│ API: UPDATE survey_responses    │    │
│   (records ONLY that NO was     │    │
│    clicked)                     │    │
│ Journey ends. No downstream.    │    │
└─────────────────────────────────┘    │
        │                              │
        └─────────────┬────────────────┘
                      ▼
              Thank-you screen
```

### Hard dependency from Onboarding

Journey A Step 3a.1 cannot fire without a usable `redirectURL` per platform. Resolving these is **[[Onboarding]]'s** responsibility — see the "redirectURL hard requirement" section in that note. If onboarding has not produced a URL for the platform the owner enabled, Journey A's happy YES button has nowhere to send the customer.

---

## Journey B · Deep TruForm (`/f/[slug]`)

Single-screen, no branching. Used when the owner wants ONE clean metric (NPS / CSAT / CES / custom 1–10) without the happy/unhappy fork.

```
QR / link
   │
   ▼
GET trpc.survey.getPublicLegacyTruform({ slug, preview })
   │  Returns: { id, name, type, config, branding }
   │  type ∈ { 'nps', 'csat', 'ces', 'custom' }
   ▼
Customer picks score
   - NpsInput      0–10 grid
   - CsatInput     1–5 stars
   - CesInput      1–7 grid (label: very-difficult → very-easy)
   - custom        1–10 grid
   │
Customer OPTIONALLY fills: name, email, phone
   │
   ▼
POST trpc.survey.submitLegacyTruform({ truformId, score,
       customerName, customerEmail, customerPhone })
   │
   ▼
API writes:
   - INSERT survey_responses (single row, no session walk)
   - UPSERT customer if contact present
   - Same downstream fan-out as Journey A's unhappy branch
     (cx-routing if score is low, NEV, CLI, automations,
      notifications)
   │
   ▼
Thank-you (branding.thankYouMessage)
```

Modules touched: [[Surveys]] · [[Customers]] · [[Escalations]] · [[NEV]] · [[CLI]] · [[Automations]] · [[Notifications]] · [[Branding-Resolution]] · [[OpenRouter]].

---

## Journey C · Appointment Booking (`/book`)

Different surface — not a survey at all.

```
Customer lands at /book (from website / DM / staff share)
   │  apps/web/src/app/book/
   ▼
Picks location → service → time slot
   │  Reads availability via trpc.appointment.* from
   │     apps/api/src/appointment/
   ▼
Submits with name, phone, email
   │
   ▼
API writes:
   - INSERT appointments (location, customer, slot, status)
   - UPSERT customers
   - Schedules outbound confirmation
   │
   ▼
Email confirmation via Resend ([[Email]] module)
WhatsApp confirmation via WapiSnap Bridge ([[WapiSnap]])
   │
   ▼
[Later] After appointment, [[Automations|automation]] can
fire a post-appointment Journey A/B link via WhatsApp/Email
   → loops back into Journey A or B
```

Modules: [[Appointments]] · [[Locations]] · [[Customers]] · [[Email]] · [[WapiSnap]] · [[Automations]] · [[Notifications]].

---

## Journey D · Coupon Redemption (no dedicated public page)

```
Trigger (any of):
  - Customer hits Journey A happy YES + settings.enableCoupon
  - Owner manually issues from /dashboard/coupons
  - Automation fires on CLI segment change ("at-risk" customer)
       │
       ▼
API writes:
  - INSERT coupons row (template, customer, location,
    code, expiry, status='issued')
       │
       ▼
Delivery channel:
  - Email via Resend with code/QR
  - WhatsApp via WapiSnap with code/QR
       │
       ▼
Customer brings code to location
       │
       ▼
Staff redeems in /dashboard/coupons UI
  - UPDATE coupons.status='redeemed', redeemed_at, redeemed_by
       │
       ▼
Downstream:
  - notifications (owner alert)
  - cli recompute (loyalty bump)
  - automation rules ("redeemed → send follow-up Journey")
```

Modules: [[Coupons]] · [[Customers]] · [[Email]] · [[WapiSnap]] · [[CLI]] · [[Automations]] · [[Notifications]] · (loops back into Journey A/B).

---

---

## Journey E · External-Review Loopback (downstream of Journey A 3a.1)

This is a SEPARATE flow from Journey A. Once the customer clicks YES and leaves rectangled.io, we have no in-band visibility into what they do next. The review only re-enters our system later, asynchronously, via the platform's own API.

```
[off-platform] Customer is on Google / Zomato / Swiggy
   - Pastes (or rewrites) the AI-generated text from clipboard
   - Posts the review
   - OR abandons (we never know)
       │
       │  (hours to days later)
       ▼
[[Connectors]] adapter polls the platform on its sync cadence
   - GBP: pulls new reviews via Google My Business API
   - Zomato: pulls new reviews via scraping/partner channel
       │
       ▼
API: INSERT into reviews (workspace, location, source,
       reviewer, rating, body, status='new')
       │
       ▼
[[AI-Response]] composes a draft reply via [[OpenRouter]]
   - Prompt = review text + tone settings + matched
     [[Business-Aspects|aspect tags]]
   - Status: 'draft'
       │
       ▼
[[Notifications]] alerts the owner that a new review is in
       │
       ▼
Owner opens /dashboard/inbox, approves / edits, posts back
   - Reply posted via the same [[Connectors]] adapter
   - Status: 'posted'
       │
       ▼
Customer (on the external platform) sees the reply
   (no in-app surface; closing the loop is fully off-platform)
```

Modules: [[Connectors]] · [[Reviews]] · [[AI-Response]] · [[AI-Agent]] · [[OpenRouter]] · [[Business-Aspects]] · [[Notifications]] · [[Members]] · [[Reports]].

Linkage to Journey A: we can correlate roughly via `(workspace, location, ~time-window, reviewer-name fuzzy-match)` but there is no hard FK from `reviews` back to `survey_responses`. Treat Journey E as best-effort attribution, not deterministic.

---

## Cross-cutting data SOURCES (always feed into the above)

| Data | Where it's stored | Who consumes it inside the journey |
|---|---|---|
| Brand color, logo, displayName | `locations` then `workspaces` then system defaults | [[Branding-Resolution]] → `BrandedPublicLayout` |
| `aspectTags` (default chips) | `business_aspects` (workspace-scoped, industry-seeded in [[Onboarding]]) | Journey A unhappy branch |
| Metric thresholds, enabled metrics | `surveys.settings` | Journey A engine decides happy/unhappy |
| `reviewPlatform` + `redirectLinks` | `surveys.settings` + `locations.gbpPlaceId` etc. | Journey A happy YES |
| Workspace name (for `{businessName}` interp) | `workspaces.name` | `reviewTemplate` substitution |
| White-label footer | `organizations.white_label` | Footer rendering — see [[White-Label]] |

## Cross-cutting data SINKS (everything ends up here)

- `survey_responses` — every score + answer
- `customers` — every contact-bearing submission (upsert)
- `cx_escalations` — every rule-matched unhappy submission
- `nev_*` tables — every emotion-classified text
- `cli_*` tables — recomputed loyalty score
- `notifications` — owner-visible activity
- Outbound side: `reviews` (later, async, via [[Connectors]] when Google/Zomato finally surfaces the customer's external review)

---

## Related
- [[Surveys]] · [[Public-Pages]] · [[Branding-Resolution]] · [[Customers]] · [[Reviews]] · [[Connectors]] · [[AI-Response]] · [[Escalations]] · [[NEV]] · [[CLI]] · [[Coupons]] · [[Automations]] · [[Notifications]] · [[Appointments]] · [[Email]] · [[WapiSnap]] · [[OpenRouter]] · [[Business-Aspects]] · [[Onboarding]]
