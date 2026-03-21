import { z } from 'zod'

export const listBusinessAspectsSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const seedBusinessAspectsSchema = z.object({
  workspaceId: z.string().uuid(),
  industry: z.string(),
})

export const createBusinessAspectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  category: z.string().max(50).optional(),
})

export const updateBusinessAspectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  category: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const deleteBusinessAspectSchema = z.object({
  id: z.string().uuid(),
})

export const reorderBusinessAspectsSchema = z.object({
  workspaceId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
})
