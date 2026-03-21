import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listAppointmentsSchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  updateAppointmentStatusSchema,
  listAvailableSlotsSchema,
} from '@rectangled/shared'
import { AppointmentService } from './appointment.service'

export function createAppointmentRouter(appointmentService: AppointmentService) {
  return router({
    list: protectedProcedure
      .input(listAppointmentsSchema)
      .query(async ({ input, ctx }) => {
        return appointmentService.list(input, ctx.user.sub)
      }),

    book: protectedProcedure
      .input(bookAppointmentSchema)
      .mutation(async ({ input, ctx }) => {
        return appointmentService.book(input, ctx.user.sub)
      }),

    // Public booking endpoint (no auth required)
    publicBook: publicProcedure
      .input(bookAppointmentSchema)
      .mutation(async ({ input }) => {
        return appointmentService.book(input)
      }),

    cancel: protectedProcedure
      .input(cancelAppointmentSchema)
      .mutation(async ({ input, ctx }) => {
        return appointmentService.cancel(input, ctx.user.sub)
      }),

    updateStatus: protectedProcedure
      .input(updateAppointmentStatusSchema)
      .mutation(async ({ input, ctx }) => {
        return appointmentService.updateStatus(input, ctx.user.sub)
      }),

    // Public available slots endpoint
    availableSlots: publicProcedure
      .input(listAvailableSlotsSchema)
      .query(async ({ input }) => {
        return appointmentService.getAvailableSlots(input)
      }),
  })
}
