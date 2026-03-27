import { z } from 'zod'
import { uuidSchema } from './common'

export const listConnectorInstancesSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema.optional(),
})

export const connectConnectorSchema = z.object({
  connectorTypeId: z.string().min(1).max(50),
  workspaceId: uuidSchema,
  locationId: uuidSchema.optional(),
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
})

export const disconnectConnectorSchema = z.object({
  instanceId: uuidSchema,
  workspaceId: uuidSchema,
})

export const updateConnectorConfigSchema = z.object({
  instanceId: uuidSchema,
  workspaceId: uuidSchema,
  config: z.record(z.unknown()),
})

export const gbpAuthUrlSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema.optional(),
  redirectUrl: z.string().url(),
  placeId: z.string().optional(),
  businessName: z.string().optional(),
  businessAddress: z.string().optional(),
})

export const gbpCallbackSchema = z.object({
  code: z.string().min(1),
  workspaceId: uuidSchema,
  locationId: uuidSchema.optional(),
  redirectUrl: z.string().url(),
})

export const resolveMapsLinkSchema = z.object({
  url: z.string().url(),
  workspaceId: uuidSchema,
})

export const publishGbpPostSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema,
  type: z.enum(['STANDARD', 'EVENT', 'OFFER']),
  content: z.string().min(1).max(1500),
  title: z.string().max(255).optional(),
  imageUrl: z.string().url().optional(),
  ctaType: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  eventTitle: z.string().max(255).optional(),
  eventStartDate: z.string().optional(),
  eventEndDate: z.string().optional(),
  couponCode: z.string().max(100).optional(),
  redeemOnlineUrl: z.string().url().optional(),
  termsConditions: z.string().max(1000).optional(),
})

export const listGbpPostsSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema,
})

export const deleteGbpPostSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema,
  postId: uuidSchema,
})
