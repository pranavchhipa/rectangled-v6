import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  generateReportSchema,
  getReportSchema,
  listReportsSchema,
  deleteReportSchema,
  shareReportSchema,
  getSharedReportSchema,
  exportPdfSchema,
} from '@rectangled/shared'
import { ReportService } from './report.service'

export function createReportRouter(service: ReportService) {
  return router({
    generate: protectedProcedure
      .input(generateReportSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generateReport(input, ctx.user.sub)
      }),

    get: protectedProcedure
      .input(getReportSchema)
      .query(async ({ input, ctx }) => {
        return service.getReport(input.reportId, ctx.user.sub)
      }),

    list: protectedProcedure
      .input(listReportsSchema)
      .query(async ({ input, ctx }) => {
        return service.listReports(
          {
            workspaceId: input.workspaceId,
            reportType: input.reportType,
            page: input.page,
            limit: input.limit,
          },
          ctx.user.sub,
        )
      }),

    delete: protectedProcedure
      .input(deleteReportSchema)
      .mutation(async ({ input, ctx }) => {
        return service.deleteReport(input.reportId, ctx.user.sub)
      }),

    share: protectedProcedure
      .input(shareReportSchema)
      .mutation(async ({ input, ctx }) => {
        return service.shareReport(input.reportId, ctx.user.sub)
      }),

    exportPdf: protectedProcedure
      .input(exportPdfSchema)
      .mutation(async ({ input, ctx }) => {
        const base64 = await service.exportPdf(input.reportId, ctx.user.sub)
        return { pdf: base64 }
      }),

    // Public endpoint
    getShared: publicProcedure
      .input(getSharedReportSchema)
      .query(async ({ input }) => {
        return service.getSharedReport(input.shareToken)
      }),
  })
}
