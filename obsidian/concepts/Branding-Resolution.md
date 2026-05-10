---
type: concept
aliases: [Branding, Branding Helper]
---

# Branding Resolution

The chain that determines what a public page (`/j` or `/f`) looks like. Resolved server-side by `apps/api/src/surveys/branding.helper.ts`.

## Chain
```
1. location.brandingLogoUrl / brandColor / displayName   ← per-QR / per-location override
2. workspace.brandingLogoUrl / brandColors.primary        ← org default
3. SYSTEM defaults (#2D5BFF / null / "Powered by rectangled.io")
```

Plus single-location fallthrough (Hotfix-2): if `locationId` is null on the journey but the workspace has exactly **1 location**, fall through to that location's branding.

`displayName` is composed as `"{workspace.name} — {location.name}"` when both differ.

## PublicBranding shape (`packages/shared/src/types/branding.ts`)
```ts
interface PublicBranding {
  displayName: string       // never empty
  logoUrl: string | null    // null if no upload
  brandColor: string        // hex with leading #
  workspaceName: string     // raw, useful for {businessName} interpolation
  poweredByText: string     // default or white-labeled override
}
```

## Cursive fallback rule (Hotfix-9)
When `logoUrl` is null, the layout shows a cursive fallback in the logo circle. Source: split `displayName` on `" — "` and use the **location** half.
- "Pranav's Business — Woof Nest" → "woof" (first word of "Woof Nest")
- NOT the first word of the workspace half ("pranav's" was the bug)

## Connects to
- [[Public-Pages]] — consumer
- [[Surveys]] — engine that calls the helper
- [[Workspaces]], [[Locations]], [[Organization]] — input layers
- [[White-Label]] — `poweredByText` override layer
- [[Hotfix-Trail]]
