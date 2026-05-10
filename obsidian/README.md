---
type: hub
---

# Rectangled.io V6 — Obsidian Vault

This folder is an **Obsidian vault** that visualizes the OptimizerV6 codebase.
It is gitignored — derived from the code, not source-of-truth.

## How to open
1. Open Obsidian → **Open another vault** → select this `obsidian/` folder.
2. Open `[[00-Index]]` to start.
3. Open the **Graph view** (Ctrl/Cmd-G) to see how everything connects.

## Layout
- [[00-Index]] — main hub, links to everything
- `architecture/` — high-level system design
- `domains/` — one note per business domain (matches API modules + DB schemas)
- `concepts/` — cross-cutting ideas (branding resolution, RBAC, etc.)
- `integrations/` — external services (GBP, Razorpay, Resend, …)
- `ops/` — local dev, build, deploy, known issues

## Conventions
- `[[Wikilinks]]` between notes for the graph
- Each note points to the actual code files via repo-relative paths
- Source-of-truth is always the code; this vault is a map
