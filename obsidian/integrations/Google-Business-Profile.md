---
type: integration
aliases: [GBP, Google Business Profile]
---

# Google Business Profile

Primary [[Connectors|connector]]. OAuth-based access to fetch reviews, post replies, manage listing info, publish posts.

## Env
```
GOOGLE_CLIENT_ID=617842883423-...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=http://localhost:3050/gbp/auth
GOOGLE_API_KEY=...
```

## Adapter
`apps/api/src/connector/adapters/` — implements the [[Connectors]] interface (fetchReviews, postReply, listingInfo, publishPost).

## Connects to
- [[Connectors]] — adapter interface
- [[Reviews]] — inbound source
- [[Listings]] — NAP + posts
- [[RAIS]] — AI-drafted post copy publishes here
- [[Locations]] — each location stores its own GBP place ID + tokens
