-- Hotfix PRD §4 — Location branding on public pages.
--
-- Three new optional columns on `locations`:
--   logo_url      TEXT          — public URL of the location's logo
--   brand_color   VARCHAR(7)    — hex like "#2D5BFF"; header background
--   display_name  VARCHAR(255)  — shown to customers on QR pages;
--                                 falls back to "{workspace.name} — {location.name}"
--                                 then to workspace.name when null
--
-- Resolution order for the public renderer (pseudocode):
--   displayName = location.display_name
--               ?? `${workspace.name} — ${location.name}` (when locationId set)
--               ?? workspace.name
--   logoUrl     = location.logo_url ?? workspace.logo_url ?? null
--   brandColor  = location.brand_color
--               ?? workspace.brand_colors->>'primary'
--               ?? '#2D5BFF' (system default)
--   poweredBy   = organization.white_label.footerText (when enabled)
--               ?? 'Powered by rectangled.io'
--
-- Idempotent: each ADD COLUMN uses IF NOT EXISTS, so re-running this
-- migration is a no-op once it's applied.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS logo_url     TEXT,
  ADD COLUMN IF NOT EXISTS brand_color  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
