import { z } from 'zod'

export const listNotificationsSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  isRead: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export const markNotificationReadSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  notificationId: z.string().uuid(),
})

export const markAllNotificationsReadSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
})

export const getUnreadNotificationCountSchema = z.object({
  workspaceId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
})
