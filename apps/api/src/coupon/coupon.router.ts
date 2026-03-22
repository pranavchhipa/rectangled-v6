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
  sendCouponViaWhatsAppSchema,
  preflightCouponWhatsAppSchema,
} from '@rectangled/shared'
import { CouponService } from './coupon.service'
import type { WapisnapService } from '../wapisnap/wapisnap.service'
import type { CustomerService } from '../customer/customer.service'
import type { ConnectorService } from '../connector/connector.service'

export function createCouponRouter(
  service: CouponService,
  wapisnapService?: WapisnapService,
  customerService?: CustomerService,
  connectorService?: ConnectorService,
) {
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

    // Pre-flight check for sending coupon via WhatsApp
    preflightWhatsApp: protectedProcedure
      .input(preflightCouponWhatsAppSchema)
      .query(async ({ input, ctx }) => {
        const checks = {
          customerPhone: { ok: false, message: '', phone: '' as string | undefined, customerName: '' as string | undefined },
          wapisnap: { ok: false, message: '' },
          templates: { ok: false, message: '', templates: [] as Array<{ id: string; name: string; discountType: string; discountValue: number; validityDays: number; description?: string | null }> },
        }

        // Step 1: Check customer phone
        if (!input.customerId) {
          checks.customerPhone.message = 'No customer linked to this review. Cannot send a coupon via WhatsApp.'
        } else if (!customerService) {
          checks.customerPhone.message = 'Customer service unavailable.'
        } else {
          try {
            const customer = await customerService.getById(input.customerId, ctx.user.sub)
            if (!customer.phone) {
              checks.customerPhone.message = "This customer doesn't have a phone number in our system. Add their contact details first."
            } else {
              checks.customerPhone.ok = true
              checks.customerPhone.phone = customer.phone
              checks.customerPhone.customerName = customer.name ?? undefined
            }
          } catch {
            checks.customerPhone.message = 'Could not find customer details.'
          }
        }

        // Step 2: Check WapiSnap workspace for the location
        if (!input.locationId) {
          checks.wapisnap.message = 'No location linked to this review. WhatsApp sending requires a location with WapiSnap configured.'
        } else if (!wapisnapService) {
          checks.wapisnap.message = 'WhatsApp service unavailable.'
        } else {
          try {
            const ws = await wapisnapService.getWorkspaceForLocation(input.locationId)
            if (!ws.isActive) {
              checks.wapisnap.message = 'WapiSnap is paused for this location. Resume it in the Connectors page.'
            } else if (ws.numberStatus !== 'ready') {
              checks.wapisnap.message = 'WhatsApp number is not ready yet. Please check the Connectors page.'
            } else {
              checks.wapisnap.ok = true
            }
          } catch {
            checks.wapisnap.message = 'WhatsApp (WapiSnap) is not configured for this location. Go to Connectors to set it up.'
          }
        }

        // Step 3: Check coupon templates
        try {
          const templates = await service.listTemplates(input.workspaceId, ctx.user.sub)
          const activeTemplates = templates.filter((t: any) => t.isActive)
          if (activeTemplates.length === 0) {
            checks.templates.message = 'No active coupon templates found. Create a coupon template first.'
          } else {
            checks.templates.ok = true
            checks.templates.templates = activeTemplates.map((t: any) => ({
              id: t.id,
              name: t.name,
              discountType: t.discountType,
              discountValue: t.discountValue,
              validityDays: t.validityDays,
              description: t.description,
            }))
          }
        } catch {
          checks.templates.message = 'Failed to load coupon templates.'
        }

        return checks
      }),

    // Send coupon via WhatsApp (issue + deliver)
    sendViaWhatsApp: protectedProcedure
      .input(sendCouponViaWhatsAppSchema)
      .mutation(async ({ input, ctx }) => {
        if (!wapisnapService || !customerService) {
          return { success: false, errorCode: 'SERVICE_UNAVAILABLE', message: 'WhatsApp or customer service is not available.' }
        }

        // 1. Get customer & validate phone
        if (!input.customerId) {
          return { success: false, errorCode: 'NO_CUSTOMER', message: 'No customer linked to this review.' }
        }

        let customer: { phone: string | null; name: string | null }
        try {
          customer = await customerService.getById(input.customerId, ctx.user.sub)
        } catch {
          return { success: false, errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' }
        }

        if (!customer.phone) {
          return { success: false, errorCode: 'NO_PHONE', message: "Customer doesn't have a phone number." }
        }

        // 2. Validate location & WapiSnap
        if (!input.locationId) {
          return { success: false, errorCode: 'NO_LOCATION', message: 'No location linked. Cannot send via WhatsApp.' }
        }

        // 3. Issue the coupon
        let couponInstance: any
        try {
          couponInstance = await service.issueCoupon(
            {
              workspaceId: input.workspaceId,
              templateId: input.templateId,
              customerId: input.customerId,
              locationId: input.locationId,
              reviewId: input.reviewId,
              deliveryMethod: 'whatsapp',
            },
            ctx.user.sub,
          )
        } catch (err: any) {
          return { success: false, errorCode: 'COUPON_ISSUE_FAILED', message: err.message || 'Failed to issue coupon.' }
        }

        // 4. Build discount string
        const template = (await service.listTemplates(input.workspaceId, ctx.user.sub)).find((t: any) => t.id === input.templateId)
        const discount = template
          ? template.discountType === 'percentage'
            ? `${template.discountValue}% off`
            : template.discountType === 'flat'
              ? `Rs.${template.discountValue} off`
              : 'a free gift'
          : 'a special discount'

        // 5. Send via WapiSnap
        try {
          await wapisnapService.sendCoupon(
            input.locationId,
            customer.phone,
            customer.name || 'Customer',
            couponInstance.uniqueCode,
            discount,
          )
        } catch (err: any) {
          // Coupon is issued but delivery failed — update delivery status
          return {
            success: false,
            errorCode: 'WHATSAPP_SEND_FAILED',
            message: `Coupon ${couponInstance.uniqueCode} was issued but WhatsApp delivery failed: ${err.message || 'Unknown error'}`,
            couponCode: couponInstance.uniqueCode,
          }
        }

        return {
          success: true,
          couponCode: couponInstance.uniqueCode,
          message: `Coupon ${couponInstance.uniqueCode} sent to ${customer.phone} via WhatsApp.`,
        }
      }),
  })
}
