import { z } from 'zod'
import { nameSchema, uuidSchema, phoneSchema, emailSchema } from './common'

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
})

export type CreateLocationInput = z.infer<typeof createLocationSchema>
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>
