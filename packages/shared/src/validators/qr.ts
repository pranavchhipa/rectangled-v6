import { z } from 'zod'

export const generateJourneyQrSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  journeyId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  size: z.number().int().min(100).max(2000).optional(),
  format: z.enum(['png', 'svg']).optional(),
})

export const generateFormQrSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
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
