---
type: domain
aliases: [Reports, Analytics]
---

# Reports / Analytics

Dashboard analytics surface. 13 chart components in `apps/web/src/components/analytics/`.

## Surface
- API: `apps/api/src/report/`
- Web pages: `apps/web/src/app/dashboard/analytics/`, `apps/web/src/app/dashboard/reports/`, `apps/web/src/app/dashboard/reports/[id]/`
- Web components: `apps/web/src/components/analytics/`
- DB: `packages/db/src/schema/reports.ts`
- Validators: `packages/shared/src/validators/report.ts`

## Charts (13)
- `health-score-card`
- `rating-distribution-chart`
- `review-velocity-chart`
- `sentiment-chart` + `sentiment-trend-chart`
- `platform-comparison-chart`
- `rating-trend-chart`
- `response-rate-card`
- `top-themes-chart`
- `source-donut-chart`
- `aspect-performance-chart`
- `nev-emotion-wheel` ([[NEV]])
- `cli-segment-chart` ([[CLI]])

## Inputs
Aggregates from [[Reviews]], [[Surveys]], [[NEV]], [[CLI]], [[Connectors]], [[AI-Response]] (response rate), [[Escalations]] (SLA).

## Connects to
- [[Reviews]], [[Surveys]], [[NEV]], [[CLI]], [[Connectors]], [[AI-Response]], [[Escalations]], [[Business-Aspects]] — data sources
- [[Locations]] — per-location filters (Hotfix-5/6)
- [[Chain]] — cross-location rollups
