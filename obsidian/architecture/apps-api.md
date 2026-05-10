---
type: architecture
aliases: [apps/api, API, NestJS App]
---

# apps/api — NestJS API

Path: `apps/api/`. Port `3001`.

Entry: `apps/api/src/main.ts` → `app.module.ts` (DI root).

## Module map (27 feature modules + plumbing)

| Folder | Note |
|---|---|
| `auth/` | [[Auth]] |
| `workspace/` | [[Workspaces]] |
| `organization/` | [[Organization]] |
| `member/` | [[Members]] |
| `onboarding/` | [[Onboarding]] |
| `location/` | [[Locations]] |
| `chain/` | [[Chain]] |
| `customer/` | [[Customers]] |
| `review/` | [[Reviews]] |
| `listing/` | [[Listings]] |
| `connector/` (+ `adapters/`) | [[Connectors]] |
| `surveys/` | [[Surveys]] |
| `qr/` | [[QR]] |
| `business-aspect/` | [[Business-Aspects]] |
| `ai-response/` | [[AI-Response]] |
| `ai-agent/` | [[AI-Agent]] |
| `rais/` | [[RAIS]] |
| `nev/` | [[NEV]] |
| `cli/` | [[CLI]] |
| `coupon/` | [[Coupons]] |
| `cx-routing/` | [[Escalations]] |
| `automation/` | [[Automations]] |
| `notification/` | [[Notifications]] |
| `report/` | [[Reports]] |
| `appointment/` | [[Appointments]] |
| `email/` | [[Email]] |
| `wapisnap/` | [[WapiSnap]] |
| `billing/` | [[Billing]] |
| `internal-jobs/` | scheduled/queue jobs |
| `trpc/` | router aggregator — see [[tRPC-Pattern]] |
| `database/` | Drizzle connection module |
| `common/` | guards, decorators, error filters |

## Runtime
- NestJS hot reload on Windows takes 3-5 min — see [[Known-Issues]]
- Lazy-init external clients (Razorpay, OpenRouter) so the app starts even if envs are missing

## Related
- [[apps/web]] · [[tRPC-Pattern]] · [[Architecture-Overview]] · [[Build-and-Verify]]
