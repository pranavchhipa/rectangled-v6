---
type: architecture
---

# Architecture Overview

OptimizerV6 is a **multi-tenant SaaS** for SMBs to manage their online reputation. The unit of tenancy is the **workspace**, which owns one or more **locations**. Reviews flow in from external platforms ([[Google-Business-Profile]], [[Zomato]]) and from in-house **journeys/truforms** ([[Surveys]], [[Public-Pages]]). AI ([[OpenRouter]]) drafts responses; humans approve; replies go back via [[Connectors]] or [[Email]]/[[WapiSnap]].

## High-level layers

```
   ┌─────────────────────────────────────────────────┐
   │  Browser (Next.js 15, App Router, shadcn/ui)    │  apps/web
   └────────────────┬────────────────────────────────┘
                    │ tRPC (typed) + REST for webhooks
   ┌────────────────▼────────────────────────────────┐
   │  NestJS API (port 3001) + tRPC routers           │  apps/api
   │  ├ auth · workspace · location · member          │
   │  ├ review · listing · connector (GBP, Zomato)    │
   │  ├ surveys · qr · public-page resolution         │
   │  ├ ai-response · ai-agent · rais · nev · cli     │
   │  ├ coupon · cx-routing (escalations) · automation│
   │  ├ billing · email · wapisnap · notification     │
   │  └ trpc (aggregator) · internal-jobs             │
   └─┬───────────┬───────────────────┬────────────────┘
     │           │                   │
     ▼           ▼                   ▼
   ┌────┐   ┌──────────┐   ┌─────────────────────────┐
   │ PG │   │  Redis   │   │  External services       │
   │ 16 │   │  7       │   │  Razorpay · Resend       │
   └────┘   └──────────┘   │  OpenRouter · GBP API    │
                           │  WapiSnap Bridge         │
                           └─────────────────────────┘
```

## Tenancy model
- A [[Organization]] owns N [[Workspaces]]; a workspace owns N [[Locations]].
- A user belongs to a workspace via a [[Members|membership]] with a role (owner/admin/manager/staff).
- Every domain query is workspace-scoped — see [[Workspace-Scoping]].
- See [[Membership-RBAC]] for permission rules.

## Public surface
Two unauthenticated routes, served by [[apps/web]] but data-resolved through [[apps/api]]:
- `/j/[slug]` — journey-based multi-screen feedback ([[Public-Pages]])
- `/f/[slug]` — single-screen "truform" (NPS / CSAT / CES / custom)

## Related
- [[Tech-Stack]] · [[Monorepo-Layout]] · [[Data-Flow]] · [[tRPC-Pattern]]
