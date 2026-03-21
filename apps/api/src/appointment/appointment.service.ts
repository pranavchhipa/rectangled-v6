import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, gte, lte, desc, sql, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { appointments, connectorInstances, members, locations, workspaces } from '@rectangled/db'
import { CalendarAdapter } from '../connector/adapters/calendar.adapter'
import { ConnectorService } from '../connector/connector.service'

@Injectable()
export class AppointmentService {
  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly calendarAdapter: CalendarAdapter,
    private readonly connectorService: ConnectorService,
  ) {}

  async list(
    input: {
      workspaceId: string
      locationId?: string
      status?: string
      dateFrom?: Date
      dateTo?: Date
      page?: number
      limit?: number
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const page = input.page ?? 1
    const limit = Math.min(input.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const conditions = [eq(appointments.workspaceId, input.workspaceId)]
    if (input.locationId) conditions.push(eq(appointments.locationId, input.locationId))
    if (input.status) conditions.push(eq(appointments.status, input.status as any))
    if (input.dateFrom) conditions.push(gte(appointments.startTime, input.dateFrom))
    if (input.dateTo) conditions.push(lte(appointments.startTime, input.dateTo))

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(desc(appointments.startTime))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(where),
    ])

    // Enrich with location names
    const enriched = await Promise.all(
      data.map(async (appt) => {
        const loc = await this.db.query.locations.findFirst({
          where: eq(locations.id, appt.locationId),
        })
        return { ...appt, locationName: loc?.name ?? null }
      })
    )

    return {
      data: enriched,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit),
    }
  }

  async book(
    input: {
      workspaceId: string
      locationId: string
      customerName: string
      customerEmail?: string
      customerPhone?: string
      title: string
      startTime: Date
      endTime: Date
      notes?: string
    },
    userId?: string,
  ) {
    // If userId is provided, verify membership (dashboard booking)
    if (userId) {
      await this.requireMembership(input.workspaceId, userId)
    } else {
      // Public booking: validate workspace and location exist
      const workspace = await this.db.query.workspaces.findFirst({
        where: eq(workspaces.id, input.workspaceId),
      })
      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' })
      }

      const location = await this.db.query.locations.findFirst({
        where: and(
          eq(locations.id, input.locationId),
          eq(locations.workspaceId, input.workspaceId),
        ),
      })
      if (!location) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' })
      }
    }

    // Find the Google Calendar connector for this location
    const calendarInstance = await this.getCalendarInstance(input.locationId)
    let calendarEventId: string | null = null

    if (calendarInstance) {
      try {
        const creds = calendarInstance.credentials as Record<string, string>
        const config = calendarInstance.config as Record<string, string>
        let accessToken = creds.accessToken

        // Refresh token if expired
        if (creds.expiresAt && new Date(creds.expiresAt) <= new Date()) {
          const refreshed = await this.calendarAdapter.refreshAccessToken(creds.refreshToken)
          accessToken = refreshed.accessToken
          await this.connectorService.updateCredentials(calendarInstance.id, {
            ...creds,
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          })
        }

        const calendarId = config.calendarId || 'primary'
        const event = await this.calendarAdapter.createEvent(accessToken, calendarId, {
          summary: input.title,
          description: `Customer: ${input.customerName}\nEmail: ${input.customerEmail || 'N/A'}\nPhone: ${input.customerPhone || 'N/A'}\n${input.notes || ''}`,
          start: { dateTime: input.startTime.toISOString(), timeZone: 'Asia/Kolkata' },
          end: { dateTime: input.endTime.toISOString(), timeZone: 'Asia/Kolkata' },
          attendees: input.customerEmail ? [{ email: input.customerEmail, displayName: input.customerName }] : undefined,
        })
        calendarEventId = (event as Record<string, any>).id
      } catch (err: any) {
        // Log but don't fail — appointment still gets created locally
        console.error('Failed to create calendar event:', err.message)
      }
    }

    const [appointment] = await this.db
      .insert(appointments)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId,
        connectorInstanceId: calendarInstance?.id ?? null,
        calendarEventId,
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        status: 'scheduled',
        notes: input.notes || null,
      })
      .returning()

    return appointment
  }

  async cancel(
    input: { workspaceId: string; appointmentId: string },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const appt = await this.db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, input.appointmentId),
        eq(appointments.workspaceId, input.workspaceId),
      ),
    })

    if (!appt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found' })

    // Cancel on Google Calendar if linked
    if (appt.calendarEventId && appt.connectorInstanceId) {
      try {
        const instance = await this.connectorService.getInstanceByIdInternal(appt.connectorInstanceId)
        const creds = instance.credentials as Record<string, string>
        const config = instance.config as Record<string, string>
        await this.calendarAdapter.cancelEvent(creds.accessToken, config.calendarId || 'primary', appt.calendarEventId)
      } catch {
        // Log but don't fail
      }
    }

    const [updated] = await this.db
      .update(appointments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(appointments.id, input.appointmentId))
      .returning()

    return updated
  }

  async updateStatus(
    input: { workspaceId: string; appointmentId: string; status: string },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const [updated] = await this.db
      .update(appointments)
      .set({
        status: input.status as any,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.workspaceId, input.workspaceId),
        )
      )
      .returning()

    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found' })
    return updated
  }

  async getAvailableSlots(
    input: { workspaceId: string; locationId: string; date: Date },
  ) {
    // Validate that the workspace exists before returning any data
    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, input.workspaceId),
    })
    if (!workspace) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' })
    }

    // Validate the location belongs to this workspace
    const location = await this.db.query.locations.findFirst({
      where: and(
        eq(locations.id, input.locationId),
        eq(locations.workspaceId, input.workspaceId),
      ),
    })
    if (!location) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' })
    }

    const calendarInstance = await this.getCalendarInstance(input.locationId)

    // Generate 30-minute slots from 9 AM to 6 PM
    const slots: Array<{ start: Date; end: Date; available: boolean }> = []
    const dateStart = new Date(input.date)
    dateStart.setHours(9, 0, 0, 0)

    for (let hour = 9; hour < 18; hour++) {
      for (const minute of [0, 30]) {
        const start = new Date(dateStart)
        start.setHours(hour, minute, 0, 0)
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + 30)
        slots.push({ start, end, available: true })
      }
    }

    // Check against Google Calendar if connected
    if (calendarInstance) {
      try {
        const creds = calendarInstance.credentials as Record<string, string>
        const config = calendarInstance.config as Record<string, string>
        const busySlots = await this.calendarAdapter.getFreeBusy(
          creds.accessToken,
          config.calendarId || 'primary',
          dateStart,
          new Date(dateStart.getTime() + 24 * 60 * 60 * 1000),
        )

        for (const slot of slots) {
          for (const busy of busySlots) {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            if (slot.start < busyEnd && slot.end > busyStart) {
              slot.available = false
              break
            }
          }
        }
      } catch {
        // If calendar check fails, all slots remain available
      }
    }

    // Also check against existing appointments in DB
    const existingAppts = await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.locationId, input.locationId),
          eq(appointments.status, 'scheduled'),
          gte(appointments.startTime, dateStart),
          lte(appointments.startTime, new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)),
        )
      )

    for (const slot of slots) {
      for (const appt of existingAppts) {
        if (slot.start < appt.endTime && slot.end > appt.startTime) {
          slot.available = false
          break
        }
      }
    }

    return slots
  }

  private async getCalendarInstance(locationId: string) {
    return this.db
      .select()
      .from(connectorInstances)
      .where(
        and(
          eq(connectorInstances.locationId, locationId),
          eq(connectorInstances.connectorTypeId, 'google_calendar'),
          eq(connectorInstances.status, 'connected'),
        )
      )
      .then((rows) => rows[0] ?? null)
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt),
      ),
    })
    if (!membership) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace' })
    }
    return membership
  }
}
