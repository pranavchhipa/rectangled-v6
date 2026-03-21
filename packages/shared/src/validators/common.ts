import { z } from 'zod'

// Common validators reused across frontend forms and backend APIs

export const emailSchema = z.string().email('Invalid email address').toLowerCase().trim()

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number')
  .trim()

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name must be at most 255 characters')
  .trim()

export const uuidSchema = z.string().uuid('Invalid ID')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})
