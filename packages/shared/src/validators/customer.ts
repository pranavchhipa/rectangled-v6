import { z } from 'zod'
import { uuidSchema, paginationSchema } from './common'

export const listCustomersSchema = z
  .object({
    workspaceId: uuidSchema,
    search: z.string().max(200).optional(),
    tags: z.array(z.string()).optional(),
  })
  .merge(paginationSchema)

export const getCustomerSchema = z.object({
  customerId: uuidSchema,
})

export const createCustomerSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255).trim(),
  email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const updateCustomerSchema = z.object({
  customerId: uuidSchema,
  name: z.string().min(1).max(255).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const deleteCustomerSchema = z.object({
  customerId: uuidSchema,
})

export const getCustomerReviewsSchema = z
  .object({
    customerId: uuidSchema,
  })
  .merge(paginationSchema)

export const bulkCreateCustomersSchema = z.object({
  workspaceId: uuidSchema,
  customers: z.array(z.object({
    name: z.string().min(1).max(255).trim(),
    email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
    phone: z.string().trim().optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
  })).min(1).max(1000),
})
