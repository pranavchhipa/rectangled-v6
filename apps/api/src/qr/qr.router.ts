import { protectedProcedure, router } from '../trpc/middleware'
import {
  generateJourneyQrSchema,
  generateFormQrSchema,
  generateBulkQrSchema,
} from '@rectangled/shared'
import { QrService } from './qr.service'

export function createQrRouter(service: QrService) {
  return router({
    generateJourneyQr: protectedProcedure
      .input(generateJourneyQrSchema)
      .mutation(async ({ input, ctx }) => {
        const slug = await service.lookupJourneySlug(
          input.journeyId,
          input.workspaceId,
          ctx.user.sub
        )
        return service.generateJourneyQr(slug, input.locationId, {
          size: input.size,
          format: input.format,
        })
      }),

    generateFormQr: protectedProcedure
      .input(generateFormQrSchema)
      .mutation(async ({ input, ctx }) => {
        const slug = await service.lookupFormSlug(
          input.formId,
          input.workspaceId,
          ctx.user.sub
        )
        return service.generateFormQr(slug, {
          size: input.size,
          format: input.format,
        })
      }),

    generateBulkQr: protectedProcedure
      .input(generateBulkQrSchema)
      .mutation(async ({ input, ctx }) => {
        // Look up slugs for all items
        const items: Array<{ type: 'journey' | 'form'; slug: string; locationId?: string }> = []

        for (const item of input.items) {
          if (item.type === 'journey') {
            const slug = await service.lookupJourneySlug(
              item.id,
              input.workspaceId,
              ctx.user.sub
            )
            items.push({ type: 'journey', slug, locationId: item.locationId })
          } else {
            const slug = await service.lookupFormSlug(
              item.id,
              input.workspaceId,
              ctx.user.sub
            )
            items.push({ type: 'form', slug })
          }
        }

        return service.generateBulkQr(items)
      }),
  })
}
