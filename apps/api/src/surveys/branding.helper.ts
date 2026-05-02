/**
 * Hotfix PRD §4 — Public-page branding resolution.
 *
 * Single source of truth for the 3-tier fallback (location → workspace
 * → defaults) plus the white-label override path. Used by every public
 * GET endpoint that serves QR pages so the renderer always receives a
 * fully-resolved `branding` object regardless of which tier supplied
 * each field.
 *
 * Stays server-side because the inputs are DB rows (workspaces,
 * locations, organizations) with Drizzle types that aren't shareable
 * with the frontend. The output shape (`PublicBranding`) IS shared via
 * `@rectangled/shared` so the renderer can type its consumption.
 */

import { eq } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { workspaces, locations, organizations } from '@rectangled/db'
import {
  type PublicBranding,
  DEFAULT_BRAND_COLOR,
  DEFAULT_POWERED_BY_TEXT,
} from '@rectangled/shared'

/**
 * Resolve the branding to display on a public QR page.
 *
 * Reads workspace + (optional) location + organization in parallel. If
 * the workspace doesn't exist, throws — that's a programmer error
 * (every survey row has a non-null workspace_id). If the location
 * doesn't exist, falls back to workspace-only branding (no per-
 * location overrides applied). If the organization is missing or
 * doesn't have white_label enabled, the default tagline is used.
 */
export async function resolvePublicBranding(
  db: Database,
  workspaceId: string,
  locationId: string | null,
): Promise<PublicBranding> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  })

  if (!workspace) {
    throw new Error(
      `resolvePublicBranding: workspace ${workspaceId} not found`,
    )
  }

  // Resolve the location:
  //   1. If `locationId` is supplied → use that specific location.
  //   2. If `locationId` is NULL/undefined AND the workspace has
  //      EXACTLY ONE location → fall through to that lone location
  //      (Hotfix-2 — most SMBs run a single shop and won't bother
  //      binding every survey to "the only location they have"; the
  //      public header should still compose "Workspace — Location"
  //      instead of just "Workspace"). Multi-location workspaces keep
  //      strict behavior — null locationId means workspace-only header.
  let location: typeof locations.$inferSelect | undefined
  if (locationId) {
    location = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    })
  } else {
    const wsLocations = await db.query.locations.findMany({
      where: eq(locations.workspaceId, workspaceId),
    })
    if (wsLocations.length === 1) {
      location = wsLocations[0]
    }
  }

  const organization = workspace.organizationId
    ? await db.query.organizations.findFirst({
        where: eq(organizations.id, workspace.organizationId),
      })
    : undefined

  // ─── Display name ─────────────────────────────────────────────────
  // location.display_name (when set) wins; otherwise compose
  // "{workspace.name} — {location.name}" if a location is bound; else
  // just the workspace name.
  const displayName =
    (location?.displayName && location.displayName.trim()) ||
    (location ? `${workspace.name} — ${location.name}` : workspace.name)

  // ─── Logo ─────────────────────────────────────────────────────────
  // Per-location override → workspace fallback → null.
  const logoUrl = location?.logoUrl ?? workspace.logoUrl ?? null

  // ─── Brand color ──────────────────────────────────────────────────
  // Per-location override → workspace.brand_colors.primary → system default.
  // brand_colors is the dedicated jsonb column with a typed shape
  // ({primary, secondary, accent}); we read .primary directly rather
  // than going through workspace.settings.
  const workspacePrimary =
    workspace.brandColors?.primary &&
    typeof workspace.brandColors.primary === 'string'
      ? workspace.brandColors.primary
      : null
  const brandColor =
    location?.brandColor ?? workspacePrimary ?? DEFAULT_BRAND_COLOR

  // ─── Powered-by tagline (white-label override) ────────────────────
  // organizations.white_label.enabled === true gates the override; when
  // off (or org missing), the default rectangled.io tagline is used.
  const whiteLabel = organization?.whiteLabel
  const poweredByText =
    whiteLabel?.enabled === true && whiteLabel.footerText
      ? whiteLabel.footerText
      : DEFAULT_POWERED_BY_TEXT

  return {
    displayName,
    logoUrl,
    brandColor,
    workspaceName: workspace.name,
    poweredByText,
  }
}
