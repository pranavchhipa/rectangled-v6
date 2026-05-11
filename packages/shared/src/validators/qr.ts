import { z } from 'zod'

// ─── QR Code Management System — registry CRUD ─────────────────────────
//
// Persistent QR registry per workspace. Each row pairs a short tracking
// code with a survey destination + an owner-set label, and records
// scans against `clickCount`. Owner-facing list at /dashboard/qr.

export const qrTargetTypeSchema = z.enum(['journey', 'form'])
export const qrStatusSchema = z.enum(['active', 'archived'])

export const listQrCodesSchema = z.object({
  workspaceId: z.string().uuid(),
  status: qrStatusSchema.optional(),
  locationId: z.string().uuid().optional(),
})

export const createQrCodeSchema = z.object({
  workspaceId: z.string().uuid(),
  targetType: qrTargetTypeSchema,
  /** A `surveys.id` (journey or truform). */
  targetId: z.string().uuid(),
  label: z.string().min(1).max(255).optional(),
  locationId: z.string().uuid().optional(),
})

export const updateQrCodeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255).optional(),
  status: qrStatusSchema.optional(),
})

export const archiveQrCodeSchema = z.object({
  id: z.string().uuid(),
})

export const downloadQrCodeSchema = z.object({
  id: z.string().uuid(),
  format: z.enum(['png', 'svg']).default('png'),
  size: z.number().int().min(100).max(2000).default(600),
})

/** Public — fired by Next.js /q/[shortCode] route handler on scan. */
export const recordQrClickSchema = z.object({
  shortCode: z.string().min(1).max(32),
})

// ─── Legacy on-demand generation (kept for back-compat with the
// journeys/[id] editor's QR dialog; new code uses the registry above) ──

export const generateJourneyQrSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  membershipId: z.string().uuid().optional(),
  journeyId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  size: z.number().int().min(100).max(2000).optional(),
  format: z.enum(['png', 'svg']).optional(),
})

export const generateFormQrSchema = z.object({
  workspaceId: z.string().uuid(),
  // Hotfix-2 — was REQUIRED but the service (qr.service.ts:lookupFormSlug)
  // never reads it; auth runs through workspaceId + ctx.user.sub like
  // the journey schema. Required-ness was triggering a Zod toast on the
  // editor's QR button + leaving the dialog with no QR data. Mirroring
  // generateJourneyQrSchema's optional shape resolves both Bug 1 (empty
  // QR dialog) and Bug 2 (Zod toast) in one line.
  membershipId: z.string().uuid().optional(),
  formId: z.string().uuid(),
  size: z.number().int().min(100).max(2000).optional(),
  format: z.enum(['png', 'svg']).optional(),
})

export const generateBulkQrSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  items: z.array(
    z.object({
      type: z.enum(['journey', 'form']),
      id: z.string().uuid(),
      locationId: z.string().uuid().optional(),
    })
  ),
})
