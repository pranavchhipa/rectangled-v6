---
type: architecture
---

# Data Flow — Request Lifecycle

A typical authenticated request from browser to DB:

```
User clicks button in Next.js page
       │
       ▼
React Query hook  (e.g. trpc.review.list.useQuery({ workspaceId }))
       │  enabled: !!currentWorkspaceId   ← see [[Workspace-Scoping]]
       ▼
tRPC client (apps/web/src/lib/trpc.ts) — sends HTTP POST to /trpc/<route>
       │  Authorization: Bearer <jwt>     ← Zustand auth store, key "rectangled-auth"
       ▼
NestJS server (apps/api/src/main.ts) — Nest middleware → tRPC adapter
       │
       ▼
tRPC router runtime  (apps/api/src/trpc/) — dispatches to feature service
       │  see [[tRPC-Pattern]] for static-vs-runtime router trick
       ▼
Feature service  (e.g. apps/api/src/review/review.service.ts)
       │  1. requireMembership(userId, workspaceId)  ← see [[Membership-RBAC]]
       │  2. business logic
       ▼
Drizzle query  (packages/db/src/schema/*)
       │
       ▼
PostgreSQL 16
```

## Public-page flow (unauthenticated)

```
GET /j/[slug] or /f/[slug]
       │
       ▼
Next.js server component fetches branding + screens via tRPC public route
       │
       ▼
surveys.service resolves [[Branding-Resolution]]:
   location → workspace → system defaults
       │
       ▼
BrandedPublicLayout renders navy header + curved white card
       │  (see [[Public-Pages]] for layout shell)
       ▼
User submits → POST creates a survey_response record (skipped if ?preview=true)
```

## Webhook flow (Razorpay, GBP push, …)
- POST /webhook/<provider> hits a REST controller (one of few non-tRPC endpoints)
- Signature verified against env-stored secret
- Persisted, then async work fires via [[internal-jobs]] or directly

## Related
- [[tRPC-Pattern]] · [[Auth]] · [[Workspace-Scoping]] · [[Public-Pages]]
