import { protectedProcedure, router } from '../trpc/middleware'
import {
  listReviewsSchema,
  getReviewSchema,
  syncReviewsSchema,
  syncAllReviewsSchema,
  reviewStatsSchema,
  reviewAnalyticsSchema,
  generateResponseSchema,
  bulkGenerateResponsesSchema,
  approveResponseSchema,
  rejectResponseSchema,
  editResponseSchema,
  postResponseSchema,
  respondToReviewSchema,
  deleteReviewReplySchema,
} from '@rectangled/shared'
import { z } from 'zod'
import { ReviewService } from './review.service'

export function createReviewRouter(reviewService: ReviewService) {
  return router({
    list: protectedProcedure
      .input(listReviewsSchema)
      .query(async ({ input, ctx }) => {
        return reviewService.list(input, ctx.user.sub)
      }),

    getById: protectedProcedure
      .input(getReviewSchema)
      .query(async ({ input, ctx }) => {
        return reviewService.getById(input.reviewId, ctx.user.sub)
      }),

    sync: protectedProcedure
      .input(syncReviewsSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.syncReviews(
          input.connectorInstanceId,
          ctx.user.sub
        )
      }),

    syncAll: protectedProcedure
      .input(syncAllReviewsSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.syncAll(input.workspaceId, ctx.user.sub)
      }),

    stats: protectedProcedure
      .input(reviewStatsSchema)
      .query(async ({ input, ctx }) => {
        return reviewService.getStats(input.workspaceId, ctx.user.sub)
      }),

    analytics: protectedProcedure
      .input(reviewAnalyticsSchema)
      .query(async ({ input, ctx }) => {
        return reviewService.getAnalytics(input, ctx.user.sub)
      }),

    generateResponse: protectedProcedure
      .input(generateResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.generateResponse(
          input.reviewId,
          ctx.user.sub
        )
      }),

    bulkGenerateResponses: protectedProcedure
      .input(bulkGenerateResponsesSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.bulkGenerateResponses(
          input.reviewIds,
          ctx.user.sub
        )
      }),

    approveResponse: protectedProcedure
      .input(approveResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.approveResponse(
          input.responseId,
          ctx.user.sub
        )
      }),

    rejectResponse: protectedProcedure
      .input(rejectResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.rejectResponse(
          input.responseId,
          ctx.user.sub
        )
      }),

    editResponse: protectedProcedure
      .input(editResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.editResponse(
          input.responseId,
          input.content,
          ctx.user.sub
        )
      }),

    postResponse: protectedProcedure
      .input(postResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.postResponse(
          input.responseId,
          ctx.user.sub
        )
      }),

    respond: protectedProcedure
      .input(respondToReviewSchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.respondDirectly(
          input.reviewId,
          input.responseText,
          ctx.user.sub
        )
      }),

    deleteReply: protectedProcedure
      .input(deleteReviewReplySchema)
      .mutation(async ({ input, ctx }) => {
        return reviewService.deleteReply(
          input.reviewId,
          ctx.user.sub
        )
      }),

    // Phase 0 Fix 2 — pending AI drafts awaiting owner approval.
    listPendingAiApprovals: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          locationId: z.string().uuid().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        return reviewService.listPendingAiApprovals(input, ctx.user.sub)
      }),
  })
}
