import { protectedProcedure, router } from '../trpc/middleware'
import {
  listCustomersSchema,
  getCustomerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  deleteCustomerSchema,
  getCustomerReviewsSchema,
  bulkCreateCustomersSchema,
} from '@rectangled/shared'
import { CustomerService } from './customer.service'

export function createCustomerRouter(customerService: CustomerService) {
  return router({
    list: protectedProcedure
      .input(listCustomersSchema)
      .query(async ({ input, ctx }) => {
        return customerService.list(input, ctx.user.sub)
      }),

    getById: protectedProcedure
      .input(getCustomerSchema)
      .query(async ({ input, ctx }) => {
        return customerService.getById(input.customerId, ctx.user.sub)
      }),

    create: protectedProcedure
      .input(createCustomerSchema)
      .mutation(async ({ input, ctx }) => {
        return customerService.create(input, ctx.user.sub)
      }),

    update: protectedProcedure
      .input(updateCustomerSchema)
      .mutation(async ({ input, ctx }) => {
        return customerService.update(input, ctx.user.sub)
      }),

    delete: protectedProcedure
      .input(deleteCustomerSchema)
      .mutation(async ({ input, ctx }) => {
        return customerService.delete(input.customerId, ctx.user.sub)
      }),

    getReviews: protectedProcedure
      .input(getCustomerReviewsSchema)
      .query(async ({ input, ctx }) => {
        return customerService.getReviews(input, ctx.user.sub)
      }),

    bulkCreate: protectedProcedure
      .input(bulkCreateCustomersSchema)
      .mutation(async ({ input, ctx }) => {
        return customerService.bulkCreate(input, ctx.user.sub)
      }),
  })
}
