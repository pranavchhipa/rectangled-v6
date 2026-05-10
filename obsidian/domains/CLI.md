---
type: domain
aliases: [CLI, Customer Loyalty Index]
---

# CLI — Customer Loyalty Index

Per-customer score derived from [[Reviews]], [[Surveys|survey responses]], [[NEV]] emotion vectors, response history, and coupon usage. Visualized via the **cli-segment-chart**.

> Note: "CLI" here means **Customer Loyalty Index** — not a command-line interface.

## Surface
- API: `apps/api/src/cli/`
- Web: `apps/web/src/components/analytics/cli-segment-chart.tsx`
- DB: `packages/db/src/schema/cli.ts`
- Validators: `packages/shared/src/validators/cli.ts`
- Constants: `packages/shared/src/constants/cli.ts`

## What it does
- Computes loyalty buckets (e.g. champion / loyal / at-risk / lost)
- Drives segmentation for [[Coupons]] targeting and [[Automations]]

## Connects to
- [[Customers]] — per-customer index
- [[NEV]] — emotion inputs
- [[Coupons]] — targeting by CLI segment
- [[Automations]] — trigger on segment change
- [[Reports]]
