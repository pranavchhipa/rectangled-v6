# OptimizerV6 — Full Project Context

## DATABASE SCHEMA OVERVIEW (28 tables)

### Core Tables
- **users** — id, email, passwordHash, name, avatarUrl, googleId, emailVerified
- **workspaces** — id, name, slug, industry, logoUrl, brandColors(jsonb), tonePreset(enum), settings(jsonb), onboardingComplete
- **locations** — id, workspaceId→workspaces, name, address, city, state, country(India), phone, email, timezone(Asia/Kolkata)
- **members** — id, userId→users, workspaceId→workspaces, role(enum:owner/manager/staff/viewer), locationIds(uuid[]), invitedBy, acceptedAt
- **refreshTokens** — id, userId→users, tokenHash, expiresAt, revokedAt

### Connectors & Reviews
- **connectorTypes** — id(varchar PK), name, description, authType, bindingLevel(enum), configSchema(jsonb)
- **connectorInstances** — id, connectorTypeId→connectorTypes, workspaceId, locationId?, credentials(jsonb), config(jsonb), status(enum:connected/disconnected/error/pending), lastSyncAt
- **reviews** — id, workspaceId, locationId, connectorInstanceId?, customerId?, platform(google/zomato), platformReviewId, reviewerName, rating(1-5), text, reviewedAt, sentiment(positive/negative/neutral/mixed), sentimentScore(-1 to 1), themes(text[]), aspectTags(text[]), isEscalated
- **reviewResponses** — id, reviewId→reviews, content, status(draft/approved/posted/rejected), generatedBy(ai/human), aiModel, approvedBy?, postedAt
- **aiResponseSchedules** — id, reviewId→reviews, scheduledFor, status(pending), attempts
- **aiResponseDailyCounts** — id, locationId→locations, date, count

### Listings
- **businessListings** — id, workspaceId, locationId, connectorInstanceId, platform, name, address, hours(jsonb), attributes(jsonb), lastSyncedData(jsonb)
- **listingChangeLog** — id, listingId→businessListings, field, previousValue, newValue, changeSource, isAuthorized
- **listingPosts** — id, workspaceId, locationId, type, title, content, imageUrl, status(draft)

### Customer Experience
- **customers** — id, workspaceId, name, email, phone, tags(text[]), totalReviews, averageRating, status(new), unique(workspaceId+phone), unique(workspaceId+email)
- **journeys** — id, workspaceId, locationId?, name, slug(unique), isDefault, isActive, settings(jsonb:positiveThreshold,enableCoupon,reviewPlatform)
- **journeyScreens** — id, journeyId→journeys, order, screenType(enum:9 types), title, subtitle, config(jsonb), branchConditions(jsonb[])
- **journeyResponses** — id, journeyId, journeyScreenId?, customerId?, locationId, sessionId, responseData(jsonb)
- **truforms** — id, workspaceId, locationId?, name, type(nps/csat/ces/custom), status(draft/active/archived), config(jsonb), slug(unique)
- **truformResponses** — id, truformId→truforms, customerId?, score, answers(jsonb), completedAt

### Coupons
- **couponTemplates** — id, workspaceId, name, codePrefix, discountType(percentage/flat/freebie), discountValue, validityDays(30), isActive
- **couponInstances** — id, templateId→couponTemplates, workspaceId, customerId?, uniqueCode(unique), status(issued/redeemed/expired/cancelled), issuedAt, expiresAt, redeemedAt, deliveryMethod, deliveryStatus

### Emotion & Loyalty Scoring
- **emotionDefinitions** — id, name(unique), cluster(joy/comfort/frustration/anxiety), polarity(positive/negative), emoji, sortOrder
- **nevResponses** — id, workspaceId, customerId?, locationId?, reviewId?, source(active_survey/passive_nlp/journey), emotions(jsonb[]:emotionId+intensity), nevScore(real), rawText
- **cliResponses** — id, workspaceId, customerId?, trustScore(1-10), satisfactionScore(1-10), advocacyScore(0-10), cliScore(0-100), segment(champion/loyalist/passive/at_risk/detractor)

### Escalations & Routing
- **escalationRules** — id, workspaceId, name, triggerType(rating_threshold/aspect_match/keyword_match/sentiment/manual), triggerConfig(jsonb), assignToUserId?, assignToRole, priority(low/medium/high/critical), slaMinutes, isActive
- **escalations** — id, workspaceId, ruleId?, reviewId?, customerId?, assignedToUserId?, status(open/in_progress/resolved/expired), priority, slaDeadline, slaBreached(bool), notes, resolvedAt

### Notifications & Reports
- **notifications** — id, workspaceId, userId, type(enum:10 types), title, message, link, isRead, metadata(jsonb)
- **reportSnapshots** — id, workspaceId, reportType(enum:6 types), title, dateFrom, dateTo, locationId?, data(jsonb), shareToken(unique)

### Automations
- **automationRules** — id, workspaceId, journeyId?, name, triggerEvent(enum:6 types), delayMinutes, actionType(enum:5 types), actionConfig(jsonb), conditions(jsonb), isActive
- **automationQueue** — id, ruleId→automationRules, workspaceId, customerId?, scheduledFor, status(pending/processing/completed/failed/cancelled), attempts, lastError

### Billing
- **subscriptions** — id, workspaceId(unique), plan(free), status(active), razorpaySubscriptionId, currentPeriodStart/End, trialEndsAt
- **invoices** — id, subscriptionId→subscriptions, razorpayInvoiceId, amount, currency(INR), status(pending), paidAt

### WhatsApp (WapiSnap)
- **wapisnapWorkspaces** — id, locationId(unique), workspaceId(ext), apiKey, phoneNumber, numberStatus, isActive
- **wapisnapTemplates** — id, wapisnapWorkspaceId→wapisnapWorkspaces, name, language, category(MARKETING/UTILITY/AUTH), status(PENDING/APPROVED/REJECTED), components(jsonb[])
- **wapisnapMessages** — id, wapisnapWorkspaceId, phone, direction(outbound/inbound), type, templateName, status(queued/sent/delivered/read/failed)
- **wapisnapSequences** — id, workspaceId, customerId?, phone, status, steps(jsonb[]), currentStep, nextExecuteAt

### AI Social Content (rAIS)
- **socialPosts** — id, workspaceId, platform(enum:5), contentType(enum:5), caption, hashtags(text[]), imagePrompt, status(draft/scheduled/published/failed), scheduledFor, createdBy→users
- **contentCalendar** — id, workspaceId, date, slots(jsonb[]:time+postId+platform+status)
- **brandVoice** — id, workspaceId(unique), tone, keywords(text[]), avoidWords(text[]), samplePosts(text[]), industry

### Business Aspects & Onboarding
- **businessAspects** — id, workspaceId, name, category, isDefault, isActive, sortOrder
- **onboardingState** — id, workspaceId(unique), currentStep, completedSteps(jsonb[]), isComplete

---

## API MODULE → tRPC PROCEDURE MAPPING

| Module | Key Procedures | Notes |
|--------|---------------|-------|
| auth | register, login, googleAuthUrl, googleCallback, refresh, me, logout | Public + protected |
| workspace | create, list, getById, update, delete | |
| location | create, list, getById, update, delete | |
| member | list, invite, remove, updateRole | |
| connector | listTypes, listInstances, connect, disconnect, getGbpAuthUrl, handleGbpCallback | GBP+Zomato adapters |
| review | list, getById, sync, syncAll, stats, analytics, generateResponse, bulkGenerate, approve/reject/edit/postResponse, respond, deleteReply | Core module |
| listing | list, getById, getChanges, resolveChange, createPost, listPosts, sync, publishGbpPost, listGbpPosts, deleteGbpPost | |
| customer | list, getById, create, update, delete, search | |
| journey | list, getById, create, update, delete, addScreen, updateScreen, deleteScreen, reorder | |
| truform | list, getById, create, update, delete, addQuestion | |
| billing | getCurrentPlan, listInvoices, createCheckoutSession, cancelSubscription, handleWebhook | Razorpay |
| aiResponse | listScheduled, generateResponse, scheduleResponse, cancelSchedule, getSettings, updateSettings | OpenRouter AI |
| coupon | listTemplates, create/update/deleteTemplate, issue, bulkIssue, redeem, list, stats, verify(public) | |
| nev | seedEmotions, getEmotionDefinitions(public), submitResponse(public), getAnalytics, getTrends, analyzeText | Emotion scoring |
| cli | submitResponse(public), getAnalytics, getTrends, getSegments, getCustomerCli | Loyalty index |
| qr | generateJourneyQr, generateFormQr, generateBulkQr | QR code gen |
| automation | listRules, createRule, updateRule, deleteRule, listQueue, cancelQueued, getStats | |
| cxRouting | listRules, create/update/deleteRule, listEscalations, getEscalation, updateEscalation, resolveEscalation, getStats | SLA tracking |
| notification | list, markRead, markAllRead, unreadCount | 30s polling |
| report | generate, get, list, delete, share, exportPdf, getShared(public) | 6 report types |
| email | sendTestEmail | Resend, 7 email templates |
| wapisnap | provision, getStatus, sendReviewRequest, sendCoupon, listTemplates, syncTemplates, createSequence, cancelSequence, getDeliveryStats, pause, resume | HMAC signed |
| rais | generateCaption, generateHashtags, generateContentIdeas, generateImagePrompt, listPosts, createPost, updatePost, deletePost, getBrandVoice, updateBrandVoice, getCalendar, getContentStats | AI social |
| businessAspect | list, create, update, delete, reorder | |
| onboarding | getState, updateStep, complete | |

---

## FRONTEND → BACKEND DATA FLOW

### Auth Flow
1. Login page → `trpc.auth.login` → JWT tokens → Zustand store → localStorage('rectangled-auth')
2. All tRPC calls → httpBatchLink → reads token from localStorage → Bearer header
3. Protected procedures → `createTrpcContext` extracts user from JWT

### Review Lifecycle
1. Connector sync (GBP/Zomato) → reviews table
2. Inbox page displays → filters by rating/source/status/date
3. AI generates response → reviewResponses (status:draft)
4. Owner approves → status:approved
5. Post to platform → GBP API → status:posted
6. CX-routing evaluates → creates escalation if rules match
7. NEV analysis → emotion scoring
8. Notifications sent to team

### Journey Flow
1. Create journey with screens → QR code generated
2. Customer scans QR → public /j/[slug] page
3. Customer completes screens → journeyResponses
4. Automation rules triggered → coupon issued / message sent
5. CLI scoring calculated from responses

### Billing Flow
1. Workspace defaults to 'free' plan
2. Upgrade → Razorpay checkout session
3. Webhook confirms payment → subscription activated
4. Plan limits enforced: locations, reviews/mo, members, connectors, AI responses/day

---

## SCORING FORMULAS

### NEV Score (Net Emotional Value)
```
positiveSum = sum(positive emotion intensities)
negativeSum = sum(negative emotion intensities)
NEV = ((positiveSum - negativeSum) / (positiveSum + negativeSum)) × 100
Range: -100 to +100
```

### CLI Score (Customer Loyalty Index)
```
CLI = (trust × 3.5) + (satisfaction × 4.0) + (advocacy × 2.5)
Range: 0-100
Segments: Champion(80+), Loyalist(60-79), Passive(40-59), At Risk(20-39), Detractor(<20)
```

### Health Score
```
Composite of: average rating, response rate, sentiment ratio, review velocity
Range: 0-100
```

---

## PLAN LIMITS

| Feature | Free | Pro (₹2,999/mo) | Enterprise (₹9,999/mo) |
|---------|------|-----------------|----------------------|
| Locations | 1 | 10 | Unlimited |
| Members | 2 | 10 | Unlimited |
| Reviews/month | 50 | Unlimited | Unlimited |
| Connectors | 1 | 5 | Unlimited |
| AI Responses/day | 5 | 100 | Unlimited |
| Analytics | Basic | Advanced | Full + Export |
| Coupons | No | Yes | Yes |
| Automations | No | Yes | Yes + Custom |
| White-label | No | No | Yes |

---

## FILE NAMING CONVENTIONS
- Schema files: `packages/db/src/schema/{feature}.ts`
- Validators: `packages/shared/src/validators/{feature}.ts`
- Constants: `packages/shared/src/constants/{feature}.ts`
- API modules: `apps/api/src/{feature}/{feature}.service.ts`, `.router.ts`, `.module.ts`
- Frontend pages: `apps/web/src/app/dashboard/{feature}/page.tsx`
- UI components: `apps/web/src/components/ui/{component}.tsx` (shadcn)
- Feature components: `apps/web/src/components/{feature}/{component}.tsx`
