import { z } from 'zod'
import { nameSchema, slugSchema, uuidSchema } from './common'

export const createWorkspaceSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  industry: z.string().max(100).optional(),
})

export const updateWorkspaceSchema = z.object({
  id: uuidSchema,
  name: nameSchema.optional(),
  industry: z.string().max(100).optional(),
  // Workspace branding logo. Renders in the dashboard sidebar and is the
  // default fallback for public review pages when no per-location logo is set.
  // Accepts an https URL (image hosted anywhere) or null to clear.
  logoUrl: z.string().url().max(2048).nullable().optional(),
  brandColors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
    })
    .optional(),
  tonePreset: z.enum(['professional', 'friendly', 'empathetic', 'witty']).optional(),
  settings: z
    .object({
      defaultTimezone: z.string().optional(),
      aiAutoRespond: z.boolean().optional(),
      reviewResponseDelay: z.object({ min: z.number(), max: z.number() }).optional(),
      frequencyCap: z.object({ maxSurveys: z.number(), windowDays: z.number() }).optional(),
    })
    .optional(),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
