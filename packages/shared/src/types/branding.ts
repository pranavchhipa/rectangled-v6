/**
 * Hotfix PRD §4 — Public-page branding shape.
 *
 * The QR-scan landing pages (`/j/{slug}`, `/f/{slug}`) render a branded
 * header (logo + display name + brand-color background) that's
 * resolved server-side from a 3-tier fallback:
 *
 *   1. Per-location overrides (locations.logo_url / brand_color /
 *      display_name) — populated by the location settings UI.
 *   2. Workspace defaults (workspaces.logo_url / brand_colors.primary)
 *      — populated by onboarding or workspace settings.
 *   3. System defaults (#2D5BFF / null logo / "Powered by rectangled.io").
 *
 * White-label override: when `organizations.white_label.enabled === true`,
 * `poweredByText` is replaced with `white_label.footerText`. Owners on
 * non-white-labeled orgs see the default tagline.
 *
 * Computed by `resolvePublicBranding` in
 * `apps/api/src/surveys/branding.helper.ts` and returned from every
 * public GET endpoint (getPublicLegacyJourney, getPublicLegacyTruform,
 * adaptive getInitialState). The renderer fetches once on mount and
 * holds it in React state — submits do NOT re-emit branding because it
 * can't change mid-session.
 */

export interface PublicBranding {
  /** Owner-facing name shown in the header. Always non-empty. */
  displayName: string
  /** Public URL of the logo, or null if none configured. */
  logoUrl: string | null
  /** Hex color string with leading #, e.g. "#2D5BFF". Always non-empty. */
  brandColor: string
  /**
   * The raw workspace name. Useful for downstream copy that wants the
   * business name without the location suffix (e.g. "{businessName}"
   * interpolation in review templates).
   */
  workspaceName: string
  /**
   * Footer tagline. Default: "Powered by rectangled.io". Replaced with
   * the org's `white_label.footerText` when `white_label.enabled` is true.
   */
  poweredByText: string
}

/** System default brand color when neither location nor workspace sets one. */
export const DEFAULT_BRAND_COLOR = '#2D5BFF'

/** Default footer when the org isn't white-labeled. */
export const DEFAULT_POWERED_BY_TEXT = 'Powered by rectangled.io'
