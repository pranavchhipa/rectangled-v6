---
type: domain
aliases: [Listings, Posts]
---

# Listings

Outbound content management: GBP posts, listing accuracy across platforms.

## Surface
- API: `apps/api/src/listing/`
- Web: `apps/web/src/app/dashboard/listings/`, `apps/web/src/app/dashboard/listings/[id]/`, `apps/web/src/app/dashboard/listings/posts/`
- DB: `packages/db/src/schema/listings.ts`
- Validators: (no dedicated validator — inline in `listing` module)

## What it does
- Tracks listing health (NAP — name/address/phone consistency) per [[Connectors|connected platform]]
- Composes and schedules **posts** (GBP "What's New" / "Offer" / "Event")
- Hooks into [[RAIS]] for AI-drafted post copy

## Connects to
- [[Connectors]] — Google Business Profile is the primary listing surface
- [[RAIS]] — AI Studio for drafting post copy
- [[Locations]] — listings are per-location
- [[Reports]] — listing-quality metrics
