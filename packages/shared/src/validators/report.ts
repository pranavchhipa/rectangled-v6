import { z } from 'zod'

export const reportTypeSchema = z.enum([
  'orm_overview',
  'aspect_analysis',
  'truforms_feedback',
  'journey_analytics',
  'nev_report',
  'cli_report',
])

export const generateReportSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportType: reportTypeSchema,
  dateFrom: z.string(),
  dateTo: z.string(),
  locationId: z.string().uuid().optional(),
})

export const getReportSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportId: z.string().uuid(),
})

export const listReportsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportType: reportTypeSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export const deleteReportSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportId: z.string().uuid(),
})

export const shareReportSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportId: z.string().uuid(),
})

export const getSharedReportSchema = z.object({
  shareToken: z.string().min(1).max(50),
})

export const exportPdfSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reportId: z.string().uuid(),
})
