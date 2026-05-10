---
type: integration
aliases: [Zomato]
---

# Zomato

Read-side [[Connectors|connector]] for inbound reviews from Zomato. No public API for posting replies — read-only.

## Adapter
`apps/api/src/connector/adapters/` — implements `fetchReviews` (likely scraping or partner API).

## Connects to
- [[Connectors]] — adapter interface
- [[Reviews]] — inbound source
- [[Locations]] — Zomato res_id stored per location
