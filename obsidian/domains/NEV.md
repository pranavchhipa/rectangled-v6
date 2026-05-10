---
type: domain
aliases: [NEV, Net Emotion Value, Emotion Scoring]
---

# NEV — Net Emotion Value

Emotion-vector scoring derived from [[Reviews]] + [[Surveys|survey responses]]. Visualized in dashboard via the **NEV emotion wheel** chart.

## Surface
- API: `apps/api/src/nev/`
- Web: `apps/web/src/components/analytics/nev-emotion-wheel.tsx` (one of the 13 analytics charts)
- DB: `packages/db/src/schema/nev.ts`
- Validators: `packages/shared/src/validators/nev.ts`
- Constants: `packages/shared/src/constants/emotions.ts`

## What it scores
- Per-review or per-response emotion vector across categorical axes (joy, anger, surprise, …)
- Aggregated into workspace + location rollups
- Trended in the **sentiment-trend-chart**

## Connects to
- [[Reviews]] — primary input
- [[Surveys]] — secondary input
- [[Reports]] — emotion wheel + sentiment trend
- [[CLI]] — feeds loyalty signals
- [[Customers]] — per-customer emotion view
- [[OpenRouter]] — likely classifier path
