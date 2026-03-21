import { protectedProcedure, router } from '../trpc/middleware'
import {
  listNotificationsSchema,
  markNotificationReadSchema,
  markAllNotificationsReadSchema,
  getUnreadNotificationCountSchema,
} from '@rectangled/shared'
import { NotificationService } from './notification.service'

export function createNotificationRouter(service: NotificationService) {
  return router({
    list: protectedProcedure
      .input(listNotificationsSchema)
      .query(async ({ input, ctx }) => {
        return service.list(input, ctx.user.sub)
      }),

    markRead: protectedProcedure
      .input(markNotificationReadSchema)
      .mutation(async ({ input, ctx }) => {
        return service.markRead(input.workspaceId, input.notificationId, ctx.user.sub)
      }),

    markAllRead: protectedProcedure
      .input(markAllNotificationsReadSchema)
      .mutation(async ({ input, ctx }) => {
        return service.markAllRead(input.workspaceId, ctx.user.sub)
      }),

    unreadCount: protectedProcedure
      .input(getUnreadNotificationCountSchema)
      .query(async ({ input, ctx }) => {
        return service.getUnreadCount(input.workspaceId, ctx.user.sub)
      }),
  })
}
