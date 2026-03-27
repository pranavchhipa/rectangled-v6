import { protectedProcedure, router } from '../trpc/middleware'
import {
  listConnectorInstancesSchema,
  connectConnectorSchema,
  disconnectConnectorSchema,
  updateConnectorConfigSchema,
  gbpAuthUrlSchema,
  gbpCallbackSchema,
  resolveMapsLinkSchema,
} from '@rectangled/shared'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { ConnectorService } from './connector.service'
import { GbpAdapter } from './adapters/gbp.adapter'
import { CalendarAdapter } from './adapters/calendar.adapter'

export function createConnectorRouter(
  connectorService: ConnectorService,
  gbpAdapter?: GbpAdapter,
  calendarAdapter?: CalendarAdapter,
) {
  return router({
    listTypes: protectedProcedure.query(async () => {
      return connectorService.listTypes()
    }),

    listInstances: protectedProcedure
      .input(listConnectorInstancesSchema)
      .query(async ({ input, ctx }) => {
        return connectorService.listInstances(
          input.workspaceId,
          input.locationId,
          ctx.user.sub
        )
      }),

    connect: protectedProcedure
      .input(connectConnectorSchema)
      .mutation(async ({ input, ctx }) => {
        return connectorService.connect(input, ctx.user.sub)
      }),

    disconnect: protectedProcedure
      .input(disconnectConnectorSchema)
      .mutation(async ({ input, ctx }) => {
        return connectorService.disconnect(input.instanceId, input.workspaceId, ctx.user.sub)
      }),

    updateConfig: protectedProcedure
      .input(updateConnectorConfigSchema)
      .mutation(async ({ input, ctx }) => {
        return connectorService.updateConfig(
          input.instanceId,
          input.workspaceId,
          input.config,
          ctx.user.sub
        )
      }),

    getGbpAuthUrl: protectedProcedure
      .input(gbpAuthUrlSchema)
      .query(({ input }) => {
        if (!gbpAdapter) {
          return { url: '' }
        }
        const state = JSON.stringify({
          workspaceId: input.workspaceId,
          locationId: input.locationId,
          placeId: input.placeId,
          businessName: input.businessName,
          businessAddress: input.businessAddress,
        })
        return { url: gbpAdapter.getAuthUrl(input.redirectUrl, state) }
      }),

    resolveMapsLink: protectedProcedure
      .input(resolveMapsLinkSchema)
      .mutation(async ({ input }) => {
        if (!gbpAdapter) {
          throw new Error('GBP adapter not configured')
        }

        return gbpAdapter.resolveMapsLink(input.url)
      }),

    handleGbpCallback: protectedProcedure
      .input(
        gbpCallbackSchema.extend({
          placeId: z.string().optional(),
          businessName: z.string().optional(),
          businessAddress: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!gbpAdapter) {
          throw new Error('GBP adapter not configured')
        }

        // Exchange code for tokens
        const tokens = await gbpAdapter.exchangeCode(
          input.code,
          input.redirectUrl
        )

        // Build config from place data if provided, or auto-discover
        const config: Record<string, unknown> = {}
        if (input.placeId) {
          // Verify the authorized Google account actually owns/manages this business
          const locationMatch = await gbpAdapter.findLocationByPlaceId(
            tokens.accessToken,
            input.placeId
          )

          if (!locationMatch) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                'This Google account is not an owner or manager of the selected business. ' +
                'Please authorize with the Google account that manages this business on Google Business Profile, ' +
                'or claim the business at https://business.google.com first.',
            })
          }

          config.placeId = input.placeId
          config.businessName = input.businessName ?? ''
          config.businessAddress = input.businessAddress ?? ''
          config.accountName = locationMatch.accountName
          config.locationName = locationMatch.locationName
        } else {
          // No placeId — auto-discover first location from authorized account
          const discovered = await gbpAdapter.getFirstLocation(tokens.accessToken)
          if (discovered) {
            config.accountName = discovered.accountName
            config.locationName = discovered.locationName
            if (discovered.placeId) config.placeId = discovered.placeId
            if (discovered.businessName) config.businessName = discovered.businessName
          }
        }

        // Create or update connector instance
        const instance = await connectorService.connect(
          {
            connectorTypeId: 'gbp',
            workspaceId: input.workspaceId,
            locationId: input.locationId,
            credentials: {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
            },
            config,
          },
          ctx.user.sub
        )

        // Update status to connected
        await connectorService.updateStatus(instance.id, 'connected')

        return instance
      }),

    // ─── Google Calendar OAuth ─────────────
    getCalendarAuthUrl: protectedProcedure
      .input(z.object({
        workspaceId: z.string().uuid(),
        locationId: z.string().uuid().optional(),
        redirectUrl: z.string().url(),
      }))
      .query(async ({ input }) => {
        if (!calendarAdapter) throw new Error('Calendar adapter not configured')
        const state = JSON.stringify({ workspaceId: input.workspaceId, locationId: input.locationId })
        return { url: calendarAdapter.getAuthUrl(input.redirectUrl, state) }
      }),

    handleCalendarCallback: protectedProcedure
      .input(z.object({
        code: z.string(),
        workspaceId: z.string().uuid(),
        locationId: z.string().uuid().optional(),
        redirectUrl: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!calendarAdapter) throw new Error('Calendar adapter not configured')
        const tokens = await calendarAdapter.exchangeCode(input.code, input.redirectUrl)
        const calendars = await calendarAdapter.listCalendars(tokens.accessToken)
        const primaryCalendar = calendars.find((c: any) => c.primary) ?? calendars[0]

        const instance = await connectorService.connect(
          {
            connectorTypeId: 'google_calendar',
            workspaceId: input.workspaceId,
            locationId: input.locationId,
            credentials: {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
            },
            config: { calendarId: primaryCalendar?.id ?? 'primary' },
          },
          ctx.user.sub
        )

        await connectorService.updateStatus(instance.id, 'connected')
        return { success: true, calendarId: primaryCalendar?.id }
      }),
  })
}
