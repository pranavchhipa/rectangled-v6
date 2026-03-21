import { z } from 'zod'
import { uuidSchema, paginationSchema } from './common'

export const listAppointmentsSchema = z
  .object({
    workspaceId: uuidSchema,
    locationId: uuidSchema.optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .merge(paginationSchema)

export const bookAppointmentSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema,
  customerName: z.string().min(1).max(255),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(20).optional(),
  title: z.string().min(1).max(255),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  notes: z.string().max(1000).optional(),
})

export const cancelAppointmentSchema = z.object({
  workspaceId: uuidSchema,
  appointmentId: uuidSchema,
})

export const updateAppointmentStatusSchema = z.object({
  workspaceId: uuidSchema,
  appointmentId: uuidSchema,
  status: z.enum(['completed', 'cancelled', 'no_show']),
})

export const listAvailableSlotsSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema,
  date: z.coerce.date(),
})
