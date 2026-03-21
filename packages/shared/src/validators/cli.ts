import { z } from 'zod'

export const submitCliResponseSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  trustScore: z.number().min(1).max(10),
  satisfactionScore: z.number().min(1).max(10),
  advocacyScore: z.number().min(0).max(10),
  truformResponseId: z.string().uuid().optional(),
  journeyResponseId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
})

export const getCliAnalyticsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const getCliTrendsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const getCliSegmentsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
})

export const getCustomerCliSchema = z.object({
  workspaceId: z.string().uuid(),
  customerId: z.string().uuid(),
})
