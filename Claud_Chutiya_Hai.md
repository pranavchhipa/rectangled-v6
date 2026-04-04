# Rectangled.io — Complete Product Requirements Document

> **Platform:** AI-native Online Reputation Management (ORM) for Indian SMBs
> **Architecture:** Turborepo Monorepo — Next.js 15 + NestJS + tRPC + Drizzle ORM + PostgreSQL 16
> **Date:** 2026-04-04

---

## Mind Map — System Overview

```
                                    ┌─────────────────────┐
                                    │   RECTANGLED.IO     │
                                    │   (Workspace)       │
                                    └─────────┬───────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
              ┌─────┴─────┐           ┌───────┴───────┐         ┌──────┴──────┐
              │ LOCATIONS  │           │  CONNECTORS   │         │   MEMBERS   │
              │ (branches) │           │ (GBP, Zomato) │         │  (team)     │
              └─────┬─────┘           └───────┬───────┘         └─────────────┘
                    │                         │
       ┌────────────┼────────────┬────────────┘
       │            │            │
 ┌─────┴─────┐ ┌───┴────┐ ┌────┴─────┐
 │ JOURNEYS  │ │ INBOX  │ │TRUFORMS  │
 │(feedback  │ │(reviews│ │(surveys) │
 │ collector)│ │ hub)   │ │          │
 └─────┬─────┘ └───┬────┘ └────┬─────┘
       │            │           │
       ├────────────┼───────────┤
       │            │           │
 ┌─────┴─────┐     │     ┌─────┴─────┐
 │CUSTOMERS  │◄────┘     │  COUPONS  │
 │(CRM +     │           │(incentive │
 │ scoring)  │◄──────────│ engine)   │
 └─────┬─────┘           └─────┬─────┘
       │                       │
       └───────────┬───────────┘
                   │
          ┌────────┴────────┐
          │ POST-REVIEW     │
          │ AUTOMATION      │
          │ (rules engine)  │
          └────────┬────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
   ┌────┴───┐ ┌───┴───┐ ┌───┴────┐
   │AI Reply│ │Send   │ │Escalate│
   │to Goog │ │Coupon │ │Ticket  │
   └────────┘ └───────┘ └────────┘
```

### Data Flow Mind Map

```
 QR Scan / Link Click
        │
        ▼
 ┌──────────────┐     ┌───────────────┐
 │  PUBLIC       │     │  GBP/ZOMATO   │
 │  JOURNEY PAGE │     │  SYNC         │
 │  /j/{slug}    │     │  (connector)  │
 └──────┬───────┘     └───────┬───────┘
        │                     │
   Rate ★★★★★           Reviews pulled
        │                     │
        ▼                     ▼
 ┌──────────────────────────────────┐
 │          INBOX                   │
 │  (all reviews: online+offline)  │
 └──────────┬───────────────────────┘
            │
     ┌──────┼──────────┐
     │      │          │
     ▼      ▼          ▼
 ┌──────┐ ┌─────┐ ┌────────┐
 │ AI   │ │Auto │ │Escalate│
 │Reply │ │Send │ │(CX     │
 │Draft │ │Coup │ │Routing)│
 └──┬───┘ └──┬──┘ └───┬────┘
    │        │        │
    ▼        ▼        ▼
 Posted   WhatsApp  Manager
 to       delivery  notified
 Google              + SLA
```

---

# SEGMENT 1: LOCATIONS

## Product Definition

Locations represent physical business branches. Every piece of data in Rectangled flows through a location — reviews are per-location, journeys are per-location, connectors bind per-location. A workspace can have 1 to N locations.

## Who Uses It

- **Business Owner:** Creates locations for each branch
- **Manager:** Assigned to specific locations via member.locationIds
- **System:** Uses locationId as FK across all modules

## Functionality

| Feature | Description |
|---------|-------------|
| Create Location | Name, address, city, state, country, phone, email, ownerName, timezone |
| Edit Location | Update any field |
| Toggle Active | Soft-disable a location without deleting |
| Delete Location | CASCADE deletes all linked data (reviews, journeys, connectors, etc.) |
| List Locations | All locations in workspace |

## Database Schema — `locations`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| address | TEXT | nullable |
| city | VARCHAR(100) | nullable |
| state | VARCHAR(100) | nullable |
| country | VARCHAR(100) | DEFAULT 'India', NOT NULL |
| phone | VARCHAR(20) | nullable |
| email | VARCHAR(255) | nullable |
| ownerName | VARCHAR(255) | nullable |
| timezone | VARCHAR(50) | DEFAULT 'Asia/Kolkata', NOT NULL |
| isActive | BOOLEAN | DEFAULT true, NOT NULL |
| settings | JSONB | DEFAULT {}, NOT NULL |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| location.create | Mutation | Protected | Create new location |
| location.list | Query | Protected | List all in workspace |
| location.getById | Query | Protected | Get single location |
| location.update | Mutation | Protected | Update location fields |
| location.delete | Mutation | Protected | Delete + CASCADE |
| location.toggleActive | Mutation | Protected | Toggle isActive flag |

## Relations (Who depends on Locations)

```
locations ──┬──> connectorInstances (GBP/Zomato per location)
            ├──> reviews (which branch got the review)
            ├──> journeys (journey assigned to branch)
            ├──> journeyResponses (response at which branch)
            ├──> truforms (form for which branch)
            ├──> couponInstances (coupon issued at branch)
            ├──> escalations (escalation for which branch)
            ├──> reportSnapshots (report per branch)
            ├──> nevResponses (emotional scoring per branch)
            ├──> cliResponses (loyalty scoring per branch)
            ├──> businessListings (listing per branch)
            ├──> listingPosts (posts per branch)
            └──> wapisnapWorkspaces (WhatsApp per branch)
```

## Data Flow

```
Owner creates location "Woof Nest, Jaipur"
    → Connect GBP connector to this location (stores placeId)
    → Create Journey linked to this location
    → Generate QR code for this location's journey
    → Customer scans QR → response stored with locationId
    → Reviews synced from Google for this location
    → Analytics filtered by this location
```

---

# SEGMENT 2: INBOX (Reviews)

## Product Definition

The Inbox is the unified review management hub. It aggregates reviews from Google (via GBP connector), Zomato (via Zomato connector), and offline reviews (from journey responses with low ratings). Each review can get an AI-generated response, be manually replied to, or be escalated.

## Who Uses It

- **Business Owner/Manager:** Reads reviews, approves AI replies, posts responses
- **Staff:** Views reviews assigned to their location
- **System:** Syncs reviews from platforms, generates AI replies, creates offline reviews from journeys

## Functionality

| Feature | Description |
|---------|-------------|
| Review List | Filterable by platform, rating, sentiment, location, date range, response status |
| Review Sync | Pull latest reviews from GBP/Zomato connectors |
| Sync All | Sync reviews from all connectors in workspace |
| AI Response Generation | GPT-4o-mini generates reply based on review text, tone, business context |
| Bulk AI Generation | Generate responses for multiple reviews at once |
| Response Workflow | draft → approved → posted (or rejected) |
| Direct Reply | Write manual response + post to Google |
| Delete Reply | Remove posted reply from Google |
| Review Stats | Aggregate metrics (avg rating, total, by platform) |
| Review Analytics | Time-series, sentiment distribution, theme analysis |
| Send Coupon via WhatsApp | Pre-flight check + issue coupon + deliver via WapiSnap |

## Database Schema — `reviews`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| locationId | UUID | FK locations, CASCADE, nullable |
| connectorInstanceId | UUID | FK connectorInstances, SET NULL, nullable |
| customerId | UUID | FK customers, SET NULL, nullable |
| platform | VARCHAR(50) | NOT NULL ('google', 'zomato', 'offline') |
| platformReviewId | VARCHAR(255) | NOT NULL |
| reviewerName | VARCHAR(255) | nullable |
| reviewerAvatarUrl | TEXT | nullable |
| rating | INTEGER | NOT NULL (1-5) |
| text | TEXT | nullable |
| reviewedAt | TIMESTAMP | NOT NULL |
| language | VARCHAR(10) | DEFAULT 'en' |
| sentiment | VARCHAR(20) | nullable ('positive', 'negative', 'neutral', 'mixed') |
| sentimentScore | REAL | nullable (-1.0 to 1.0) |
| themes | TEXT[] | nullable |
| metadata | JSONB | DEFAULT {}, NOT NULL |
| source | VARCHAR(20) | DEFAULT 'online', NOT NULL |
| journeyResponseId | UUID | nullable (loose ref, no FK) |
| aspectTags | TEXT[] | nullable |
| isEscalated | BOOLEAN | DEFAULT false |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

**Unique Index:** (workspaceId, platform, platformReviewId) — prevents duplicate imports

## Database Schema — `review_responses`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| reviewId | UUID | FK reviews, CASCADE, NOT NULL |
| content | TEXT | NOT NULL |
| status | VARCHAR(20) | DEFAULT 'draft' ('draft', 'approved', 'posted', 'rejected') |
| generatedBy | VARCHAR(20) | DEFAULT 'ai' ('ai', 'human') |
| aiModel | VARCHAR(100) | nullable |
| approvedBy | UUID | FK users, SET NULL, nullable |
| postedAt | TIMESTAMP | nullable |
| platformResponseId | VARCHAR(255) | nullable |
| metadata | JSONB | DEFAULT {} |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| review.list | Query | Protected | List reviews with filters (platform, rating, sentiment, location, date, status) |
| review.getById | Query | Protected | Get single review with responses |
| review.sync | Mutation | Protected | Sync reviews from specific connector |
| review.syncAll | Mutation | Protected | Sync from all connectors in workspace |
| review.stats | Query | Protected | Aggregate review stats |
| review.analytics | Query | Protected | Time-series analytics |
| review.generateResponse | Mutation | Protected | AI-generate reply for single review |
| review.bulkGenerateResponses | Mutation | Protected | AI-generate replies for multiple reviews |
| review.approveResponse | Mutation | Protected | Approve draft → approved |
| review.rejectResponse | Mutation | Protected | Reject draft |
| review.editResponse | Mutation | Protected | Edit response content |
| review.postResponse | Mutation | Protected | Post approved response to platform |
| review.respond | Mutation | Protected | Write + post direct reply |
| review.deleteReply | Mutation | Protected | Delete posted reply from Google |

## Data Flow — Review Lifecycle

```
Source 1: GBP Connector Sync
    Google Business Profile → connector.sync() → reviews table
    → AI response auto-generated (if automation rule active)
    → Appears in Inbox

Source 2: Zomato Connector Sync
    Zomato API → reviews table
    → Appears in Inbox (no reply capability — Zomato API doesn't support it)

Source 3: Journey Response (Offline)
    Customer rates 1-3 stars in journey
    → journey.submitResponse() creates review with:
      platform='offline', source='journey'
    → Appears in Inbox alongside online reviews

Response Flow:
    Review in Inbox → Generate AI Reply → Draft created
    → Owner reviews → Approves → Clicks "Post"
    → API posts reply to Google via GBP OAuth
    → Status updated to 'posted', postedAt set
```

## AI Response Generation

```
Input: review.text, review.rating, business context
Model: OpenRouter → gpt-4o-mini
Tone: professional | friendly | empathetic | witty
Output: Draft response stored in review_responses table
Post: Via GBP adapter using review.metadata.reviewResourceName
```

---

# SEGMENT 3: JOURNEYS

## Product Definition

Journeys are customizable customer feedback flows. A journey is a sequence of screens that a customer interacts with after visiting a business. The primary use case is collecting star ratings, routing happy customers to Google for reviews, and capturing detailed feedback from unhappy customers.

## Who Uses It

- **Business Owner:** Creates journeys, assigns to locations, generates QR codes
- **Customer (Public):** Scans QR → rates → gets routed based on rating
- **System:** Auto-fills Google review URL from GBP, triggers automations

## Functionality

| Feature | Description |
|---------|-------------|
| Journey CRUD | Create, update, archive, toggle active |
| Screen Builder | Add/remove/reorder screens, configure each |
| 9 Screen Types | rating, nps, csat, ces, feedback, aspects, contact_collection, review_redirect, thank_you |
| Single-Screen Mode | 1 rating screen with embedded feedback + redirect + thank you config |
| Location Binding | Journey linked to specific location for GBP auto-fill |
| GBP Auto-Fill | Google review URL auto-populated from connector's placeId |
| QR Code | Generate PNG/SVG QR codes linking to /j/{slug} |
| Public Survey | No-auth customer-facing page |
| Response Collection | Store ratings, feedback, tags, contact info |
| Customer Creation | Auto-create customer record from response contact info |
| Offline Review | Low ratings (≤3) create offline review entries |
| Location Filter | Filter journeys by location on list page |

## Database Schema — `journeys`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| locationId | UUID | FK locations, CASCADE, nullable |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(100) | UNIQUE, NOT NULL (format: j-{uuid-10}) |
| isDefault | BOOLEAN | DEFAULT false |
| isActive | BOOLEAN | DEFAULT true |
| settings | JSONB | NOT NULL {positiveThreshold, enableCoupon, reviewPlatform} |
| archivedAt | TIMESTAMP | nullable |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## Database Schema — `journey_screens`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| journeyId | UUID | FK journeys, CASCADE, NOT NULL |
| order | INTEGER | NOT NULL (0-indexed) |
| screenType | ENUM | NOT NULL (rating, aspects, review_redirect, feedback, contact_collection, thank_you, nps, csat, ces) |
| title | TEXT | nullable |
| subtitle | TEXT | nullable |
| config | JSONB | DEFAULT {}, NOT NULL |
| branchConditions | JSONB[] | DEFAULT [], NOT NULL |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## Database Schema — `journey_responses`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| journeyId | UUID | FK journeys, CASCADE, NOT NULL |
| journeyScreenId | UUID | FK journey_screens, SET NULL, nullable |
| customerId | UUID | FK customers, SET NULL, nullable |
| locationId | UUID | FK locations, CASCADE, nullable |
| sessionId | VARCHAR(100) | NOT NULL |
| responseData | JSONB | DEFAULT {}, NOT NULL |
| ipAddress | VARCHAR(45) | nullable |
| userAgent | TEXT | nullable |
| createdAt | TIMESTAMP | DEFAULT now() |

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| journey.list | Query | Protected | List with location + archived filters |
| journey.getById | Query | Protected | Get journey + screens |
| journey.create | Mutation | Protected | Create with locationId + auto-screens |
| journey.update | Mutation | Protected | Update name, locationId, isActive, settings |
| journey.updateScreens | Mutation | Protected | Replace all screens |
| journey.archive | Mutation | Protected | Soft-delete |
| journey.getPublic | Query | **Public** | Get active journey by slug |
| journey.submitResponse | Mutation | **Public** | Submit customer response |
| qr.generateJourneyQr | Mutation | Protected | Generate QR data URL |

## Screen Config Shapes

**Rating (Single-Screen Mode):**
```json
{
  "maxRating": 5,
  "positiveThreshold": 4,
  "iconStyle": "stars",
  "feedbackTags": ["Food Quality", "Service", "Cleanliness"],
  "feedbackPlaceholder": "Tell us more (optional)...",
  "redirectMessage": "Please share your experience on Google!",
  "redirectLinks": [{"platform": "Google", "url": "https://search.google.com/local/writereview?placeid=..."}],
  "thankYouMessage": "We appreciate your feedback!",
  "showCoupon": false
}
```

**NPS:** `{ question, lowLabel, highLabel }`
**CSAT:** `{ question, scaleType: 'stars'|'emojis'|'numbers' }`
**CES:** `{ question, lowLabel, midLabel, highLabel }`

## Data Flow

```
QR Scan → /j/{slug} → Fetch journey (public, no auth)
    → Customer taps stars
    → IF rating >= threshold:
        → Redirect to Google review URL
        → Submit response (rating only)
    → IF rating < threshold:
        → Show feedback dialog (tags + textarea)
        → Submit response (rating + feedback + tags)
        → Backend creates offline review
        → Automation triggers fire
    → Thank you message displayed
```

---

# SEGMENT 4: POST-REVIEW AUTOMATION

## Product Definition

The automation engine executes actions after events occur — a journey is completed, a review is posted, a customer goes dormant. Rules define WHEN to act (trigger + delay), WHAT to do (action), and under WHAT conditions. Actions are queued and processed asynchronously.

## Who Uses It

- **Business Owner:** Configures automation rules per journey or workspace-wide
- **System:** Matches events to rules, queues actions, processes queue

## Functionality

| Feature | Description |
|---------|-------------|
| Rule CRUD | Create, update, delete automation rules |
| 7 Trigger Events | journey_completed_positive/negative, journey_abandoned, review_posted, review_posted_google, customer_dormant, custom |
| 6 Action Types | send_coupon, send_message, create_escalation, tag_customer, trigger_journey, ai_reply_review |
| Delay Scheduling | Each rule has delayMinutes (execute after X minutes) |
| Queue Processing | Background processor finds pending items, executes actions |
| Queue Management | List, cancel, view stats |
| AI Reply to Google | Generate AI reply → refresh OAuth → post to Google via GBP adapter |
| Default Rules | 3 seeded rules on journey creation |

## Database Schema — `automation_rules`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| journeyId | UUID | FK journeys, CASCADE, nullable (null = global) |
| name | VARCHAR(255) | NOT NULL |
| triggerEvent | ENUM | NOT NULL |
| delayMinutes | INTEGER | NOT NULL |
| actionType | ENUM | NOT NULL |
| actionConfig | JSONB | DEFAULT {}, NOT NULL |
| conditions | JSONB | nullable |
| isActive | BOOLEAN | DEFAULT true |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

**Trigger Events:** journey_completed_positive, journey_completed_negative, journey_abandoned, review_posted, review_posted_google, customer_dormant, custom

**Action Types:** send_coupon, send_message, create_escalation, tag_customer, trigger_journey, ai_reply_review

## Database Schema — `automation_queue`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| ruleId | UUID | FK automation_rules, CASCADE, NOT NULL |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| customerId | UUID | FK customers, SET NULL, nullable |
| journeyResponseId | UUID | FK journey_responses, SET NULL, nullable |
| reviewId | UUID | FK reviews, SET NULL, nullable |
| scheduledFor | TIMESTAMP | NOT NULL |
| status | ENUM | DEFAULT 'pending' (pending, processing, completed, failed, cancelled) |
| attempts | INTEGER | DEFAULT 0 |
| lastError | TEXT | nullable |
| completedAt | TIMESTAMP | nullable |
| metadata | JSONB | DEFAULT {} |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| automation.listRules | Query | Protected | List rules for workspace/journey |
| automation.createRule | Mutation | Protected | Create new rule |
| automation.updateRule | Mutation | Protected | Update existing rule |
| automation.deleteRule | Mutation | Protected | Delete rule |
| automation.listQueue | Query | Protected | List queue with pagination + status filter |
| automation.cancelQueued | Mutation | Protected | Cancel pending item |
| automation.getStats | Query | Protected | Aggregated stats by status + actionType |

## Action Config Shapes

```json
// send_coupon
{ "couponTemplateId": "uuid" }

// send_message
{ "channel": "email|whatsapp", "templateId": "uuid" }

// create_escalation
{ "priority": "low|medium|high|critical" }

// tag_customer
{ "tags": ["returning", "vip"] }

// trigger_journey
{ "journeyId": "uuid" }

// ai_reply_review
{
  "ratingFilter": "all|positive|negative",
  "tone": "professional|friendly|casual",
  "includeBusinessName": true,
  "maxLength": "short|medium|long"
}
```

## Default Rules (Seeded on Journey Creation)

| Rule | Trigger | Delay | Action |
|------|---------|-------|--------|
| Thank positive reviewers | journey_completed_positive | 3 days | send_message |
| Win-back negative reviewers | journey_completed_negative | 1 day | send_coupon |
| Remind abandoned journeys | journey_abandoned | 2 hours | send_message |

## Data Flow — Automation Execution

```
Event occurs (journey response submitted, review posted)
    │
    ▼
Match against automation_rules
    (triggerEvent match + conditions check + isActive)
    │
    ▼
Create automation_queue entry
    scheduledFor = now + rule.delayMinutes
    │
    ▼
Background processor polls queue
    (WHERE status='pending' AND scheduledFor <= now)
    │
    ▼
Execute action:
    ├─ send_coupon → Issue coupon from template
    ├─ send_message → Email/WhatsApp delivery
    ├─ create_escalation → Create escalation ticket
    ├─ tag_customer → Add tags to customer
    ├─ trigger_journey → Start new journey
    └─ ai_reply_review:
         ├─ Load review from DB
         ├─ Check ratingFilter
         ├─ Generate AI reply (OpenRouter/gpt-4o-mini)
         ├─ Refresh GBP OAuth token if expired
         └─ Post reply to Google via GBP adapter
    │
    ▼
Update queue status (completed/failed + error message)
```

## Escalation System (CX Routing) — Connected to Automation

### `escalation_rules` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| workspaceId | UUID | FK workspaces |
| name | VARCHAR(255) | Rule name |
| triggerType | ENUM | rating_threshold, aspect_match, keyword_match, sentiment, manual |
| triggerConfig | JSONB | Trigger-specific config |
| assignToUserId | UUID | FK users, nullable |
| assignToRole | VARCHAR(50) | nullable |
| priority | ENUM | low, medium, high, critical |
| slaMinutes | INTEGER | SLA deadline in minutes |
| isActive | BOOLEAN | DEFAULT true |
| sortOrder | INTEGER | Evaluation order |

### `escalations` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| workspaceId | UUID | FK workspaces |
| ruleId | UUID | FK escalation_rules |
| reviewId | UUID | FK reviews |
| customerId | UUID | FK customers |
| locationId | UUID | FK locations |
| assignedToUserId | UUID | FK users |
| status | ENUM | open, in_progress, resolved, expired, closed |
| priority | ENUM | low, medium, high, critical |
| slaDeadline | TIMESTAMP | When SLA breaches |
| slaBreached | BOOLEAN | DEFAULT false |
| notes | TEXT | Resolution notes |
| ticketNumber | INTEGER | Auto-incrementing |
| activityLog | JSONB[] | {text, authorId, authorName, timestamp}[] |
| resolvedAt | TIMESTAMP | nullable |
| resolvedByUserId | UUID | FK users |

---

# SEGMENT 5: TRUFORMS

## Product Definition

TruForms is a survey/form builder for collecting structured customer feedback beyond star ratings. Supports NPS, CSAT, CES, and custom question types. Forms have their own public URLs and QR codes.

## Who Uses It

- **Business Owner:** Creates forms with questions, shares via QR/link
- **Customer (Public):** Fills out form, submits responses
- **System:** Aggregates response stats, links to NEV/CLI scoring

## Functionality

| Feature | Description |
|---------|-------------|
| Form CRUD | Create, update, delete forms |
| Form Types | nps, csat, ces, custom |
| Question Builder | Add questions with type, title, options, required flag |
| Status Workflow | draft → active → archived |
| Activate/Archive | Lifecycle management |
| Public Form Page | No-auth form rendering at /f/{slug} |
| Response Collection | Store answers per question |
| Response List | View all responses with pagination |
| Form Stats | Aggregate metrics (response count, avg score, completion rate) |
| QR Code | Generate QR for form URL |
| Location Binding | Form linked to specific location |

## Database Schema — `truforms`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| locationId | UUID | FK locations, CASCADE, nullable |
| name | VARCHAR(255) | NOT NULL |
| type | ENUM | NOT NULL (nps, csat, ces, custom) |
| status | ENUM | DEFAULT 'draft' (draft, active, archived) |
| config | JSONB | NOT NULL (see Config shape below) |
| slug | VARCHAR(100) | UNIQUE, NOT NULL |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

**Config JSONB shape:**
```json
{
  "questions": [
    {
      "id": "uuid",
      "type": "rating|text|select|multiselect|nps|csat|ces",
      "title": "How was your experience?",
      "options": ["Good", "Average", "Bad"],
      "required": true
    }
  ],
  "branding": {},
  "thankYouMessage": "Thank you for your feedback!"
}
```

## Database Schema — `truform_responses`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| truformId | UUID | FK truforms, CASCADE, NOT NULL |
| customerId | UUID | FK customers, SET NULL, nullable |
| score | INTEGER | nullable (overall score) |
| answers | JSONB | DEFAULT {}, NOT NULL |
| metadata | JSONB | DEFAULT {} |
| completedAt | TIMESTAMP | nullable |
| createdAt | TIMESTAMP | DEFAULT now() |

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| truform.list | Query | Protected | List forms with location filter |
| truform.getById | Query | Protected | Get single form |
| truform.create | Mutation | Protected | Create new form |
| truform.update | Mutation | Protected | Update form config/name |
| truform.delete | Mutation | Protected | Delete form |
| truform.activate | Mutation | Protected | Set status to 'active' |
| truform.archive | Mutation | Protected | Set status to 'archived' |
| truform.getPublic | Query | **Public** | Get active form by slug |
| truform.submitResponse | Mutation | **Public** | Submit form response |
| truform.getResponses | Query | Protected | List responses with pagination |
| truform.getStats | Query | Protected | Aggregate form stats |

## Data Flow

```
Owner creates TruForm "Post-Visit NPS Survey"
    → Adds questions (NPS 0-10, text feedback, select options)
    → Activates form → slug generated
    → Generates QR code
    │
Customer scans QR → /f/{slug}
    → Fills out form
    → Submits → truform_responses created
    → Score calculated
    → NEV/CLI scoring may trigger
```

---

# SEGMENT 6: COUPONS

## Product Definition

The coupon system incentivizes customer behavior. Templates define reusable coupon structures (discount type, value, validity). Instances are individually issued coupons with unique codes, linked to customers, locations, journey responses, or reviews. Delivery is via WhatsApp, email, SMS, in-app, or manual.

## Who Uses It

- **Business Owner:** Creates templates, issues coupons, tracks redemptions
- **Automation:** Issues coupons automatically after negative reviews
- **Customer:** Receives coupon code, redeems at business

## Functionality

| Feature | Description |
|---------|-------------|
| Template CRUD | Create, update, delete coupon templates |
| Issue Coupon | Issue single coupon to customer |
| Bulk Issue | Issue coupons to multiple customers |
| Redeem Coupon | Mark coupon as redeemed |
| Verify Coupon | Public endpoint to check coupon validity |
| List Coupons | Filter by status, customer, template |
| Coupon Stats | Issued, redeemed, expired counts per template |
| AI Generate | Generate coupon template using AI |
| WhatsApp Pre-flight | Check customer phone, WapiSnap config, templates before sending |
| WhatsApp Send | Issue coupon + deliver via WhatsApp |

## Database Schema — `coupon_templates`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| codePrefix | VARCHAR(20) | NOT NULL |
| discountType | ENUM | NOT NULL (percentage, flat, freebie) |
| discountValue | REAL | NOT NULL |
| description | TEXT | nullable |
| termsAndConditions | TEXT | nullable |
| maxRedemptions | INTEGER | nullable (null = unlimited) |
| validityDays | INTEGER | DEFAULT 30 |
| isActive | BOOLEAN | DEFAULT true |
| metadata | JSONB | DEFAULT {} |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## Database Schema — `coupon_instances`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| templateId | UUID | FK coupon_templates, CASCADE, NOT NULL |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| customerId | UUID | FK customers, SET NULL, nullable |
| locationId | UUID | FK locations, SET NULL, nullable |
| journeyResponseId | UUID | FK journey_responses, SET NULL, nullable |
| reviewId | UUID | FK reviews, SET NULL, nullable |
| uniqueCode | VARCHAR(50) | UNIQUE, NOT NULL |
| status | ENUM | DEFAULT 'issued' (issued, redeemed, expired, cancelled) |
| issuedAt | TIMESTAMP | DEFAULT now() |
| expiresAt | TIMESTAMP | NOT NULL (issuedAt + template.validityDays) |
| redeemedAt | TIMESTAMP | nullable |
| deliveryMethod | ENUM | NOT NULL (whatsapp, email, sms, in_app, manual) |
| deliveryStatus | ENUM | DEFAULT 'pending' (pending, sent, delivered, failed) |
| metadata | JSONB | DEFAULT {} |
| createdAt | TIMESTAMP | DEFAULT now() |
| updatedAt | TIMESTAMP | DEFAULT now() |

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| coupon.listTemplates | Query | Protected | List all templates |
| coupon.createTemplate | Mutation | Protected | Create template |
| coupon.updateTemplate | Mutation | Protected | Update template |
| coupon.deleteTemplate | Mutation | Protected | Delete template |
| coupon.issue | Mutation | Protected | Issue single coupon |
| coupon.bulkIssue | Mutation | Protected | Issue to multiple customers |
| coupon.redeem | Mutation | Protected | Redeem by code |
| coupon.list | Query | Protected | List issued coupons with filters |
| coupon.stats | Query | Protected | Template-level stats |
| coupon.verify | Query | **Public** | Verify coupon code validity |
| coupon.generateWithAi | Mutation | Protected | AI-generated template |
| coupon.preflightWhatsApp | Query | Protected | Check prerequisites for WhatsApp send |
| coupon.sendViaWhatsApp | Mutation | Protected | Issue + deliver via WapiSnap |

## Data Flow — Coupon Issuance via WhatsApp

```
Negative review appears in Inbox
    → Owner clicks "Send Coupon"
    → Pre-flight check:
        ├─ Customer has phone number? ✓
        ├─ WapiSnap configured for location? ✓
        └─ Active coupon templates exist? ✓
    → Owner selects template (e.g. "20% off")
    → System:
        1. Issues coupon (generates unique code: PREFIX-XXXXXX)
        2. Sets expiresAt = now + template.validityDays
        3. Sends via WapiSnap to customer's phone
        4. Updates deliveryStatus
    → Customer receives WhatsApp message with coupon code
    → Customer visits business, shows code
    → Staff redeems via coupon.redeem endpoint
```

---

# SEGMENT 7: CUSTOMERS

## Product Definition

The customer module is the CRM backbone. Customers are created automatically from journey responses and review data, or manually/bulk-imported. Each customer has tags, review history, and advanced scoring (NEV for emotional value, CLI for loyalty segmentation).

## Who Uses It

- **System:** Auto-creates from journey responses, links reviews to customers
- **Business Owner:** Views customer profiles, adds tags, exports data
- **Automation:** Tags customers, sends targeted messages

## Functionality

| Feature | Description |
|---------|-------------|
| Customer CRUD | Create, update, delete customers |
| Bulk Create | Import multiple customers at once |
| Customer List | Filter by tags, status, search by name/email/phone |
| Customer Profile | Name, email, phone, tags, metadata, review stats |
| Review History | Get all reviews linked to a customer |
| Auto-Creation | Created from journey response contact info |
| Dedup | Unique index on (workspaceId, email) and (workspaceId, phone) |
| Tagging | Free-form text[] tags |
| Status Tracking | 'new', 'active', 'returning', etc. |
| Activity Tracking | firstSeenAt, lastSeenAt |
| Review Aggregation | totalReviews, averageRating auto-calculated |

## Database Schema — `customers`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, random |
| workspaceId | UUID | FK workspaces, CASCADE, NOT NULL |
| name | VARCHAR(255) | nullable |
| email | VARCHAR(255) | nullable |
| phone | VARCHAR(20) | nullable |
| tags | TEXT[] | DEFAULT [], NOT NULL |
| metadata | JSONB | DEFAULT {}, NOT NULL |
| totalReviews | INTEGER | DEFAULT 0 |
| averageRating | REAL | nullable |
| status | VARCHAR(20) | DEFAULT 'new' |
| firstSeenAt | TIMESTAMP | DEFAULT now() |
| lastSeenAt | TIMESTAMP | DEFAULT now() |
| createdAt | TIMESTAMP | DEFAULT now() |

**Unique Indexes:**
- `(workspaceId, phone)` — no duplicate phone per workspace
- `(workspaceId, email)` — no duplicate email per workspace

## API Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| customer.list | Query | Protected | List with search, tag filter, pagination |
| customer.getById | Query | Protected | Get single customer profile |
| customer.create | Mutation | Protected | Create customer |
| customer.update | Mutation | Protected | Update name, email, phone, tags, metadata |
| customer.delete | Mutation | Protected | Delete customer |
| customer.getReviews | Query | Protected | Get all reviews for customer |
| customer.bulkCreate | Mutation | Protected | Import multiple customers |

## NEV (Net Emotional Value) Scoring

### `nev_responses` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| workspaceId | UUID | FK workspaces |
| customerId | UUID | FK customers |
| locationId | UUID | FK locations |
| reviewId | UUID | FK reviews (source: passive NLP) |
| truformResponseId | UUID | FK truform_responses (source: survey) |
| journeyResponseId | UUID | FK journey_responses (source: journey) |
| source | ENUM | active_survey, passive_nlp, journey |
| emotions | JSONB | [{emotionId, intensity}] array |
| nevScore | REAL | Calculated emotional value |
| rawText | TEXT | Source text analyzed |

### `emotion_definitions` Table (Seeded)

| Column | Type | Description |
|--------|------|-------------|
| name | VARCHAR(50) | Emotion name (e.g. 'delight', 'frustration') |
| cluster | ENUM | joy, comfort, frustration, anxiety |
| polarity | ENUM | positive, negative |
| emoji | VARCHAR(10) | Visual representation |
| description | TEXT | What this emotion means |

## CLI (Customer Loyalty Index) Scoring

### `cli_responses` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| workspaceId | UUID | FK workspaces |
| customerId | UUID | FK customers |
| locationId | UUID | FK locations |
| truformResponseId | UUID | FK truform_responses |
| journeyResponseId | UUID | FK journey_responses |
| trustScore | REAL | 1-10 |
| satisfactionScore | REAL | 1-10 |
| advocacyScore | REAL | 0-10 |
| cliScore | REAL | 0-100 (composite) |
| segment | VARCHAR(20) | champion, loyalist, passive, at_risk, detractor |

## Data Flow — Customer Lifecycle

```
Customer created via:
    1. Journey response with contact info
    2. Manual creation in dashboard
    3. Bulk CSV import
    4. Review sync (reviewer matched by name/email)
        │
        ▼
Customer record in DB
    ├── Reviews linked (totalReviews, averageRating updated)
    ├── Journey responses linked
    ├── TruForm responses linked
    ├── Coupons issued/redeemed tracked
    ├── NEV scoring (emotional analysis)
    ├── CLI scoring (loyalty segmentation)
    └── Tags applied (manual + automation)
        │
        ▼
Customer segments:
    champion (CLI 80-100) → Advocate programs
    loyalist (CLI 60-80)  → Retention focus
    passive (CLI 40-60)   → Engagement needed
    at_risk (CLI 20-40)   → Win-back campaigns
    detractor (CLI 0-20)  → Damage control
```

---

# CROSS-SEGMENT DEPENDENCY MAP

```
┌──────────────────────────────────────────────────────────────────────┐
│                        WORKSPACE (tenant)                            │
│                                                                      │
│  LOCATIONS ────────────────────────────────────────────────────────  │
│      │                                                               │
│      ├── CONNECTORS (GBP/Zomato per location)                       │
│      │       │                                                       │
│      │       ├── Review Sync → INBOX (reviews table)                │
│      │       └── GBP placeId → JOURNEYS (auto-fill Google URL)      │
│      │                                                               │
│      ├── JOURNEYS (feedback collector per location)                  │
│      │       │                                                       │
│      │       ├── Customer response → CUSTOMERS (auto-create)        │
│      │       ├── Low rating → INBOX (offline review)                │
│      │       ├── Response → AUTOMATION (trigger rules)              │
│      │       └── Response → NEV/CLI (scoring)                       │
│      │                                                               │
│      ├── TRUFORMS (surveys per location)                             │
│      │       │                                                       │
│      │       ├── Response → CUSTOMERS (link)                        │
│      │       └── Response → NEV/CLI (scoring)                       │
│      │                                                               │
│      ├── COUPONS (issued per location)                               │
│      │       │                                                       │
│      │       ├── Template → AUTOMATION (send_coupon action)         │
│      │       ├── Instance → CUSTOMERS (linked)                      │
│      │       ├── Instance → JOURNEY RESPONSE (linked)               │
│      │       └── Delivery → WAPISNAP (WhatsApp)                     │
│      │                                                               │
│      └── ESCALATIONS (per location)                                  │
│              │                                                       │
│              ├── Triggered by → REVIEWS (rating/sentiment)          │
│              ├── Assigned to → TEAM MEMBERS                         │
│              └── Created by → AUTOMATION (create_escalation)        │
│                                                                      │
│  AUTOMATION ENGINE ──────────────────────────────────────────────    │
│      │                                                               │
│      ├── Triggers from: Journeys, Reviews                           │
│      ├── Actions to: Coupons, Messages, Escalations, Customers     │
│      └── AI Reply to: Google (via GBP connector)                    │
│                                                                      │
│  CUSTOMERS (CRM) ────────────────────────────────────────────────   │
│      │                                                               │
│      ├── Fed by: Journeys, Reviews, TruForms, Manual                │
│      ├── Scored by: NEV (emotional), CLI (loyalty)                  │
│      └── Actioned on: Coupons, Messages, Tags, Journeys            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

# COMPLETE ENUM REFERENCE

| Enum | Values |
|------|--------|
| screen_type | rating, aspects, review_redirect, feedback, contact_collection, thank_you, nps, csat, ces |
| truform_type | nps, csat, ces, custom |
| truform_status | draft, active, archived |
| connector_status | connected, disconnected, error, pending |
| binding_level | workspace, location |
| tone_preset | professional, friendly, empathetic, witty |
| discount_type | percentage, flat, freebie |
| coupon_status | issued, redeemed, expired, cancelled |
| delivery_method | whatsapp, email, sms, in_app, manual |
| delivery_status | pending, sent, delivered, failed |
| automation_trigger | journey_completed_positive, journey_completed_negative, journey_abandoned, review_posted, review_posted_google, customer_dormant, custom |
| automation_action | send_coupon, send_message, create_escalation, tag_customer, trigger_journey, ai_reply_review |
| automation_queue_status | pending, processing, completed, failed, cancelled |
| trigger_type | rating_threshold, aspect_match, keyword_match, sentiment, manual |
| escalation_priority | low, medium, high, critical |
| escalation_status | open, in_progress, resolved, expired, closed |
| emotion_cluster | joy, comfort, frustration, anxiety |
| emotion_polarity | positive, negative |
| nev_source | active_survey, passive_nlp, journey |
| role | owner, manager, staff, viewer |

---

*Generated from codebase analysis on 2026-04-04.*
*Project: Rectangled.io OptimizerV6*
