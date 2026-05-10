---
type: integration
aliases: [WapiSnap Bridge, Bridge]
---

# WapiSnap Bridge

External WhatsApp gateway service. The Rectangled API talks to it over HMAC-SHA256-signed HTTP. Architecture rationale: keep WhatsApp client/session state out of the main API, isolate baileys/whatsapp-web.js dependencies.

## Env
```
WAPISNAP_BRIDGE_URL=http://localhost:3050/bridge
WAPISNAP_BRIDGE_SECRET=
```

## Contract
- Outbound: API → Bridge POST signed with `WAPISNAP_BRIDGE_SECRET`
- Inbound: Bridge → API webhook (also signed)
- See `INTEGRATION_PROPOSAL_V6_BRIDGE.md` at repo root for the design doc

## Connects to
- [[WapiSnap]] — API-side wrapper
- [[Customers]] — recipient phone numbers
- [[Coupons]] · [[Surveys]] · [[Notifications]] — callers
