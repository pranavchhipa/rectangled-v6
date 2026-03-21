import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listCouponTemplatesSchema,
  createCouponTemplateSchema,
  updateCouponTemplateSchema,
  deleteCouponTemplateSchema,
  issueCouponSchema,
  bulkIssueCouponsSchema,
  redeemCouponSchema,
  listCouponsSchema,
  getCouponStatsSchema,
  verifyCouponSchema,
  generateCouponWithAiSchema,
} from '@rectangled/shared'
import { CouponService } from './coupon.service'

export function createCouponRouter(service: CouponService) {
  return router({
    listTemplates: protectedProcedure
      .input(listCouponTemplatesSchema)
      .query(async ({ input, ctx }) => {
        return service.listTemplates(input.workspaceId, ctx.user.sub)
      }),

    createTemplate: protectedProcedure
      .input(createCouponTemplateSchema)
      .mutation(async ({ input, ctx }) => {
        return service.createTemplate(input, ctx.user.sub)
      }),

    updateTemplate: protectedProcedure
      .input(updateCouponTemplateSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateTemplate(input, ctx.user.sub)
      }),

    deleteTemplate: protectedProcedure
      .input(deleteCouponTemplateSchema)
      .mutation(async ({ input, ctx }) => {
        return service.deleteTemplate(input.workspaceId, input.templateId, ctx.user.sub)
      }),

    issue: protectedProcedure
      .input(issueCouponSchema)
      .mutation(async ({ input, ctx }) => {
        return service.issueCoupon(input, ctx.user.sub)
      }),

    bulkIssue: protectedProcedure
      .input(bulkIssueCouponsSchema)
      .mutation(async ({ input, ctx }) => {
        return service.bulkIssueCoupons(input, ctx.user.sub)
      }),

    redeem: protectedProcedure
      .input(redeemCouponSchema)
      .mutation(async ({ input, ctx }) => {
        return service.redeemCoupon(input.workspaceId, input.couponCode, ctx.user.sub)
      }),

    list: protectedProcedure
      .input(listCouponsSchema)
      .query(async ({ input, ctx }) => {
        return service.listCoupons(input, ctx.user.sub)
      }),

    stats: protectedProcedure
      .input(getCouponStatsSchema)
      .query(async ({ input, ctx }) => {
        return service.getCouponStats(input.workspaceId, input.templateId, ctx.user.sub)
      }),

    verify: publicProcedure
      .input(verifyCouponSchema)
      .query(async ({ input }) => {
        return service.verifyCoupon(input.code)
      }),

    generateWithAi: protectedProcedure
      .input(generateCouponWithAiSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generateWithAi(input, ctx.user.sub)
      }),
  })
}
