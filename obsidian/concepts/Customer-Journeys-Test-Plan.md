---
type: concept
aliases: [Customer Journeys Test Plan, CJ QA, CJ Test Plan]
---

# Customer Journey Module — Full Test Plan

Every flow that the Customer Journey module ships, with an expected result and how to reproduce. Used as the script when driving the live app in Chrome (or anywhere else).

Target environment: `https://rectangled-io-g43cg.ondigitalocean.app`
Demo login: `test@example.com` / `password123`

> Last refreshed for commits up to `9398ea7`. If the editor's defaults change, refresh both this doc and `survey-steps.test.ts`.

---

## Legend

- ✅ — known to pass (confirmed via test or build green)
- ❌ — known to fail (root cause documented)
- 🟡 — unverified at time of writing — will be driven in Chrome
- 🔁 — regression candidate from past commits

---

## Section 1 · Authoring (Builder side, `/dashboard/journeys/...`)

### 1.1 Editor opens an existing journey
**Reproduce:** Login → click "Customer Journeys" in sidebar → click any row.
**Expected:** Decision-tree canvas renders with the saved step graph. No console errors.

### 1.2 Add every step type — verify each saves without validator error
For each button in the "+ Add step" palette, click it and confirm:
- New node appears on the canvas
- No red toast / no Zod-shaped JSON error
- Reloading the page shows the new step persisted

Buttons to cover (commit `9398ea7` added unit-level proof, this is the runtime smoke):

- 🟡 Rating Question (`ask_metric`)
- 🟡 Open Question (`ask_question`)
- 🟡 Route by Score (`branch_by_score`)
- 🟡 Route by Answer (`branch_by_answer`)
- 🟡 Info Screen (`show_message`)
- 🟡 Contact Form (`collect_contact`)
- 🟡 Review Redirect (`redirect`)
- 🟡 Thank You Screen (`end_journey`)

### 1.3 Edit a step's copy
**Reproduce:** Click a step → edit `question` or `body` in the side sheet → click Save.
**Expected:** Updated value persists across reload.

### 1.4 Wire an edge between two steps via drag
**Reproduce:** Drag handle from source node to target.
**Expected:**
- Single-pointer steps (ask_metric, ask_question, show_message, collect_contact) → next pointer set, persisted.
- Multi-pointer steps (branch_by_score, branch_by_answer, redirect) → toast says "open it to pick which one"; clicking the source opens the side editor.

### 1.5 Delete a step
**Reproduce:** Click step → click delete in side sheet.
**Expected:**
- Step removed from canvas.
- Any pointer that targeted it becomes null (red dashed dead-end edge).

### 1.6 Custom journey wizard
**Reproduce:** From `/dashboard/journeys` → "+ Create Custom Journey" → step through.
**Expected:** Wizard produces a valid 5-step graph using `buildCustomStepsFromWizard`; no Zod errors.

---

## Section 2 · Public scan — `/j/[slug]` (Journey route)

The journey route serves `template ∈ {quick, adaptive, custom}`. Per the diagnosis in `Customer-Journeys.md` Step 3a.1 + Path B notes, the current implementation walks a flattened single-screen view, not the full step graph.

### 2.1 Page loads + branding renders
**Reproduce:** Open `https://rectangled-io-g43cg.ondigitalocean.app/j/<slug>`.
**Expected:** Branded navy header, white card with curved top, business name, no console errors.
🟡 Behavior at time of writing.

### 2.2 Asks one metric, branches to happy / unhappy
**Reproduce:** Pick a score that crosses the threshold for happy, then again for unhappy.
**Expected:**
- Happy → review prompt (Yes/No)
- Unhappy → aspect chips + free-text + contact

### 2.3 Happy YES — Phase 1 AI clipboard
**Reproduce:** Score above threshold → click YES.
**Expected:**
- Helper text "An AI-generated review will be copied for you to paste" visible under the YES button.
- Click triggers `trpc.survey.generateHappyReviewDraft`.
- Clipboard contains AI-composed review text (NOT the static `Had a great experience at <name>!`).
- New tab opens at the redirect URL (Google/Zomato/Swiggy).
- Survey response row records `acceptedReviewPrompt: true` and `redirectedTo`.

### 2.4 Happy NO
**Reproduce:** Score above threshold → click NO ("Maybe later").
**Expected:** Thank-you screen, response records `acceptedReviewPrompt: false`. No redirect.

### 2.5 Unhappy submit
**Reproduce:** Score below threshold → pick aspects → type feedback → fill contact → submit.
**Expected:** Thank-you screen, response records `aspectTags`, `feedback`, customer upsert. Console clean.

### 2.6 Preview mode
**Reproduce:** Append `?preview=true` to `/j/<slug>`.
**Expected:**
- Amber banner: "Preview mode · responses are NOT saved · close this tab to exit".
- Engine drops `status='active'` filter (works on draft journeys).
- No `survey_responses` / `survey_starts` / `customers` rows created.

### 2.7 Multi-step graph honored (Path B)
**Reproduce:** Build a journey with an extra Open Question between metric and branch; scan it.
**Expected (post-Path B):** Customer walks the graph as built — metric → Open Question → branch → ...
**Current (pre-Path B):** Customer sees flattened single-screen, the extra Open Question is ignored.
❌ Known limitation — Path B fixes this.

### 2.8 Open edges (null nextStepId) render as friendly end-state
**Reproduce:** Build a step with a dangling `nextStepId: null` and scan.
**Expected:** Engine treats falsy as "no next step" → terminal screen, no crash.
🟡 Behavior at time of writing.

---

## Section 3 · Public scan — `/f/[slug]` (TruForm route)

The truform route serves `template='deep'`. Same Path B issue applies.

### 3.1 Page loads
**Reproduce:** Open `/f/f-c6eb79bc-7`.
**Expected:** Branded layout, ONE input matching `config.type` (nps/csat/ces/custom 1-10).
🟡 Behavior at time of writing.

### 3.2 Score input renders per type
- 🟡 NPS → 11-button row (0-10)
- 🟡 CSAT → 5 stars
- 🟡 CES → 7-button row
- 🟡 custom → 1-10 grid

### 3.3 Optional contact + submit
**Reproduce:** Pick score, fill name/email/phone, submit.
**Expected:** Thank-you screen, response written, customer upserted.

### 3.4 Multi-step deep graph honored (Path B)
**Reproduce:** The screenshot the owner shared shows a `template='deep'` survey with 9 steps including chained Open Questions and three branches. Scan that URL.
**Expected (post-Path B):** Customer walks the graph; sees Open Questions, Contact Forms, branches as built.
**Current (pre-Path B):** Customer sees one screen (NPS), then thank-you. Graph ignored entirely.
❌ Known limitation — Path B fixes this.

---

## Section 4 · Onboarding gate (Phase 2 / 2.1)

### 4.1 Onboarding Step 4: review-platform URLs are gated
**Reproduce:** Fresh workspace → reach onboarding Step 4 with all three URL inputs empty → click Next.
**Expected:** Toast: "Add at least one review-platform URL — Google, Zomato, or Swiggy. …". Wizard refuses to advance.

### 4.2 Step 4: "Find your business on Google" search
**Reproduce:** Type 3+ chars in the search box.
**Expected:** Debounced (~400ms) → dropdown of up to 5 Places matches with name + address.
- Click a result → Google URL field prefilled with `https://search.google.com/local/writereview?placeid=<id>` + green "Auto-filled" badge.

### 4.3 Step 4: manual URL paste path
**Reproduce:** Paste a URL directly into the Google input.
**Expected:** Saves. No badge (the badge is auto-fill-only).

### 4.4 Step 4: API failure fallback
**Reproduce:** Disable network → type into search.
**Expected:** "Search unavailable. Paste the URL manually below."

### 4.5 Final completion gate (`complete()`)
**Reproduce:** Get past Step 4 → click "Get Started" on Step 5.
**Expected:** `trpc.onboarding.complete` succeeds. Redirect to /dashboard.
- If you somehow have zero URLs server-side: error toast with the friendly message, NOT a stack trace.

---

## Section 5 · QR Code Management System

### 5.1 Sidebar entry visible
**Reproduce:** Login → look at left nav.
**Expected:** "QR Codes" entry below "Customer Journeys".

### 5.2 List page renders
**Reproduce:** Navigate to `/dashboard/qr`.
**Expected:**
- Stats strip: Total QRs / Active / Total scans
- Searchable + filterable table
- Empty-state CTA when no rows
- ⚠️ **REQUIRES migration 0022 applied.** Without it, `trpc.qr.list` returns "relation qr_codes does not exist" → toast error.

### 5.3 Create QR
**Reproduce:** Click "+ Create QR" → pick journey/truform → set label → Create.
**Expected:**
- New row appears in the table.
- Short code is 8 chars base64url.
- Tracking URL is `{APP_URL}/q/<shortCode>`.
- `clickCount = 0` initially.

### 5.4 Download PNG
**Reproduce:** Row action menu → "Download PNG".
**Expected:** Browser downloads `qr-<shortCode>.png`.

### 5.5 Download SVG
**Reproduce:** Row action menu → "Download SVG".
**Expected:** Browser downloads `qr-<shortCode>.svg`.

### 5.6 Copy tracking link
**Reproduce:** Click copy icon in the table OR row action menu.
**Expected:** Clipboard contains the trackable short URL. Toast "Link copied".

### 5.7 Scan tracking — click counter increments
**Reproduce:** Open the tracking URL in a new tab (e.g., paste `<APP_URL>/q/<shortCode>`).
**Expected:**
- 302 redirect to the journey/truform.
- Reload the dashboard `/dashboard/qr` table → that row's scan count went up by 1.

### 5.8 Archive a QR
**Reproduce:** Row action menu → Archive.
**Expected:**
- Row's status badge flips to "archived".
- Active count in stats strip drops by 1.
- Scanning the QR still redirects (so printed stickers don't 404) but the counter STAYS frozen.

### 5.9 Unknown short code
**Reproduce:** Open `/q/totallymadeupcode`.
**Expected:** Friendly 404 HTML: "Link not found", no stack trace.

---

## Section 6 · Cross-cutting

### 6.1 Workspace scoping
- 🟡 Switching workspaces flips every list (journeys, QRs, customers) to that workspace's data.
- 🟡 No data from workspace A leaks into workspace B.

### 6.2 Permissions — `requireMembership` gate
**Reproduce:** Try to fetch a journey from a workspace you don't belong to.
**Expected:** `FORBIDDEN` response, not data.

### 6.3 Mobile (iPhone SE 375×667)
- 🟡 Public pages (`/j` and `/f`) fit one viewport (Hotfix-9 constraint)
- 🟡 Cursive fallback uses the location half of `displayName`

---

## Sections to fill after Path B lands
- Section 7 · multi-step graph walking (end-to-end)
- Section 8 · happy / unhappy branch resolution against engine threshold
- Section 9 · engine error states (malformed graph, missing references, AI fail)
