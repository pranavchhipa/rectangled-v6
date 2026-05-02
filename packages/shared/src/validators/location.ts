import { z } from 'zod'
import { nameSchema, uuidSchema, phoneSchema, emailSchema } from './common'

// ─── Hotfix §4 follow-up — branding fields ──────────────────────────────
//
// All three are optional; the service layer treats empty strings the
// same as omitted ("clear the override, fall back to workspace").
//   displayName  — text shown to customers on QR pages
//   logoUrl      — http(s) URL of a public image (no R2 upload yet)
//   brandColor   — 6-digit hex like "#2D5BFF"
// Renderer falls back to workspace.logo_url / brand_colors.primary /
// system defaults when these are unset (resolvePublicBranding helper
// in apps/api/src/surveys/branding.helper.ts).

const optionalDisplayName = z.string().max(255).optional()

const optionalLogoUrl = z
  .string()
  .max(500)
  .refine(
    (s) => s === '' || /^https?:\/\//.test(s),
    'Logo URL must start with http:// or https:// (or be empty to clear)',
  )
  .optional()

const optionalBrandColor = z
  .string()
  .refine(
    (s) => s === '' || /^#[0-9a-fA-F]{6}$/.test(s),
    'Brand color must be a 6-digit hex like #2D5BFF (or be empty to clear)',
  )
  .optional()

export const createLocationSchema = z.object({
  workspaceId: uuidSchema,
  name: nameSchema,
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).default('India'),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  ownerName: z.string().max(255).optional(),
  timezone: z.string().max(50).default('Asia/Kolkata'),
  displayName: optionalDisplayName,
  logoUrl: optionalLogoUrl,
  brandColor: optionalBrandColor,
})

export const updateLocationSchema = z.object({
  id: uuidSchema,
  name: nameSchema.optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  ownerName: z.string().max(255).optional(),
  timezone: z.string().max(50).optional(),
  displayName: optionalDisplayName,
  logoUrl: optionalLogoUrl,
  brandColor: optionalBrandColor,
})

export type CreateLocationInput = z.infer<typeof createLocationSchema>
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>
