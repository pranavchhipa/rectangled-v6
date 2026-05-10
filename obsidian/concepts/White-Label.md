---
type: concept
aliases: [White Label, White-Label]
---

# White-Label

Per-organization override of the "Powered by rectangled.io" footer on [[Public-Pages]].

## How it works
- `organizations.white_label.enabled === true` activates white-label mode
- `organizations.white_label.footerText` replaces the default footer text in `PublicBranding.poweredByText`
- Layout: when `branding.poweredByText !== DEFAULT_POWERED_BY_TEXT`, render plain text (no rectangled.io speech-bubble brand mark).

## Resolution
- The white-label override happens **inside** the [[Branding-Resolution]] helper — by the time the layout renders, `poweredByText` already reflects the override.

## Connects to
- [[Branding-Resolution]] — where the override is applied
- [[Organization]] — owner of the flag
- [[Public-Pages]] — consumer
