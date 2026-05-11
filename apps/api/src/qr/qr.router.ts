import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  generateJourneyQrSchema,
  generateFormQrSchema,
  generateBulkQrSchema,
  listQrCodesSchema,
  createQrCodeSchema,
  updateQrCodeSchema,
  archiveQrCodeSchema,
  downloadQrCodeSchema,
  recordQrClickSchema,
} from '@rectangled/shared'
import { QrService } from './qr.service'

export function createQrRouter(service: QrService) {
  return router({
    // ─── QR Code Management System ─────────────────────────────────────
    list: protectedProcedure
      .input(listQrCodesSchema)
      .query(async ({ input, ctx }) => {
        return service.listQrCodes(input.workspaceId, ctx.user.sub, {
          status: input.status,
          locationId: input.locationId,
        })
      }),

    create: protectedProcedure
      .input(createQrCodeSchema)
      .mutation(async ({ input, ctx }) => {
        return service.createQrCode(input, ctx.user.sub)
      }),

    update: protectedProcedure
      .input(updateQrCodeSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateQrCode(input, ctx.user.sub)
      }),

    archive: protectedProcedure
      .input(archiveQrCodeSchema)
      .mutation(async ({ input, ctx }) => {
        return service.archiveQrCode(input.id, ctx.user.sub)
      }),

    download: protectedProcedure
      .input(downloadQrCodeSchema)
      .mutation(async ({ input, ctx }) => {
        return service.downloadQrCode(input, ctx.user.sub)
      }),

    // Public — Next.js /q/[shortCode] route handler fires this on scan.
    // Returns the destination URL and increments the click counter.
    recordClick: publicProcedure
      .input(recordQrClickSchema)
      .mutation(async ({ input }) => {
        return service.recordClickAndResolve(input.shortCode)
      }),

    // ─── Legacy on-demand generation (kept) ────────────────────────────
    generateJourneyQr: protectedProcedure
      .input(generateJourneyQrSchema)
      .query(async ({ input, ctx }) => {
        const slug = await service.lookupJourneySlug(
          input.journeyId,
          input.workspaceId,
          ctx.user.sub
        )
        const qrDataUrl = await service.generateJourneyQr(slug, input.locationId, {
          size: input.size,
          format: input.format,
        })
        return { qrDataUrl }
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
