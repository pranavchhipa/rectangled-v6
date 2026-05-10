---
type: domain
aliases: [Connector, Connectors Module]
---

# Connectors

Adapter layer between Rectangled and external review/listing platforms. Implementations live in `apps/api/src/connector/adapters/`.

## Surface
- API: `apps/api/src/connector/` + `apps/api/src/connector/adapters/`
- Web: `apps/web/src/app/dashboard/connectors/`, `apps/web/src/components/connector/`
- DB: `packages/db/src/schema/connectors.ts`
- Validators: `packages/shared/src/validators/connector.ts`
- Types: `packages/shared/src/types/connector.ts`
- Constants: `packages/shared/src/constants/connectors.ts`

## Supported adapters
- **Google Business Profile** ([[Google-Business-Profile]]) — OAuth, fetch reviews, post replies, manage listing info, publish posts
- **Zomato** ([[Zomato]]) — read reviews

## What's stored per connector
- OAuth tokens / scraping cookies
- Place IDs (per-location)
- Last-sync cursor
- Status flags

## Connects to
- [[Locations]] — connectors attach at the location level
- [[Reviews]] — adapters write inbound review rows
- [[Listings]] — GBP adapter handles post publish + NAP queries
- [[Workspaces]] — connector ownership

## Notes
- Each adapter implements a common interface (fetchReviews, postReply, etc.) so the [[Reviews]] inbox stays platform-agnostic.
- See [[Google-Business-Profile]] for OAuth env vars and redirect URL.
