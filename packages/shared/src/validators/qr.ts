import { z } from 'zod'

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
