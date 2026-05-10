---
type: integration
aliases: [R2, Cloudflare R2, Logo Upload]
---

# Cloudflare R2 (pending)

S3-compatible object storage for logo uploads. **Not shipped yet** — credentials exist; user has not confirmed env vars are set in DigitalOcean.

## Status (per CLAUDE.md handoff)
- Bucket: `rectangleddotio` — created
- API token: created (Access Key ID + Secret Access Key); **user explicitly chose not to rotate** despite a leaked screenshot
- DO env vars: **unconfirmed** — verify before writing the upload code

## Env (expected)
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=rectangleddotio
R2_PUBLIC_URL=<custom-domain-or-r2.dev>
```

## Code to add (still TODO)
- `apps/api/src/upload/r2.service.ts` — `@aws-sdk/client-s3` PUT/DELETE + signed URLs for direct browser → R2 uploads
- tRPC routes on `location.update` and `workspace.update` to accept `logoUrl` after upload
- UI on **Settings → Branding** (workspace) and **Locations → [id] → Branding** (per-location)

## Effect
Once `branding.logoUrl` is set, the cursive fallback in [[Public-Pages]] disappears automatically — no layout changes needed.

## Connects to
- [[Branding-Resolution]] — `logoUrl` field
- [[Public-Pages]] — display surface
- [[Workspaces]] · [[Locations]] — owners of `brandingLogoUrl`
