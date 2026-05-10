---
type: domain
aliases: [Chain]
---

# Chain

Multi-location operator view. Aggregates rollups across all [[Locations]] in a workspace (or across workspaces in an [[Organization]]).

## Surface
- API: `apps/api/src/chain/`
- Web: `apps/web/src/app/dashboard/chain/`
- Validators: `packages/shared/src/validators/chain.ts`

## What it does
- Cross-location dashboards
- Comparative metrics ([[Reports]] across locations)

## Connects to
- [[Locations]] — children
- [[Reports]] — chain-level rollups
- [[Workspaces]], [[Organization]]
