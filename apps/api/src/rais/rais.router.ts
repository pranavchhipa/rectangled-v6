import { protectedProcedure, router } from '../trpc/middleware'
import {
  generateCaptionSchema,
  generateHashtagsSchema,
  generateContentIdeasSchema,
  generateImagePromptSchema,
  listPostsSchema,
  createPostSchema,
  updatePostSchema,
  deletePostSchema,
  getBrandVoiceSchema,
  updateBrandVoiceSchema,
  getCalendarSchema,
  getContentStatsSchema,
  // RAIS V2
  analyzeReviewsSchema,
  generatePostIdeasSchema,
  generatePostSchema,
  regenerateElementSchema,
  schedulePostSchema,
  getCreditsSchema,
  getCreditLogSchema,
  getRecentTrendsSchema,
  getIndustryOpportunitiesSchema,
  makeYourOwnPostSchema,
} from '@rectangled/shared'
import { RaisService } from './rais.service'

export function createRaisRouter(service: RaisService) {
  return router({
    // =========================================================================
    // RAIS V2 — Credit System & Multi-step AI Pipeline
    // =========================================================================

    // --- Credits ---

    getCredits: protectedProcedure
      .input(getCreditsSchema)
      .query(async ({ input, ctx }) => {
        return service.getCredits(input.workspaceId)
      }),

    getCreditLog: protectedProcedure
      .input(getCreditLogSchema)
      .query(async ({ input, ctx }) => {
        return service.getCreditLog(input.workspaceId, input.limit)
      }),

    // --- Step 1: Analyze Reviews ---

    analyzeReviews: protectedProcedure
      .input(analyzeReviewsSchema)
      .mutation(async ({ input, ctx }) => {
        return service.analyzeReviews(
          input.workspaceId,
          ctx.user.sub,
          input.locationId,
          input.periodMonths,
        )
      }),

    // --- Step 2: Generate Post Ideas ---

    generatePostIdeas: protectedProcedure
      .input(generatePostIdeasSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generatePostIdeas(
          input.workspaceId,
          ctx.user.sub,
          input.analysisId,
        )
      }),

    // --- Step 3: Generate Post ---

    generatePost: protectedProcedure
      .input(generatePostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generatePost(
          input.workspaceId,
          ctx.user.sub,
          input.ideaIndex,
          input.analysisId,
        )
      }),

    // --- Step 4: Regenerate Element ---

    regenerateElement: protectedProcedure
      .input(regenerateElementSchema)
      .mutation(async ({ input, ctx }) => {
        return service.regenerateElement(
          input.workspaceId,
          ctx.user.sub,
          input.postId,
          input.element,
        )
      }),

    // --- Step 5: Schedule & Trends ---

    schedulePost: protectedProcedure
      .input(schedulePostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.schedulePost(
          input.workspaceId,
          input.postId,
          new Date(input.scheduledFor),
          input.platform,
        )
      }),

    getRecentTrends: protectedProcedure
      .input(getRecentTrendsSchema)
      .mutation(async ({ input, ctx }) => {
        return service.getRecentTrends(
          input.workspaceId,
          ctx.user.sub,
          input.country,
        )
      }),

    getIndustryOpportunities: protectedProcedure
      .input(getIndustryOpportunitiesSchema)
      .mutation(async ({ input, ctx }) => {
        return service.getIndustryOpportunities(
          input.workspaceId,
          ctx.user.sub,
          input.industry,
        )
      }),

    // --- Part C: Make Your Own Post ---

    makeYourOwnPost: protectedProcedure
      .input(makeYourOwnPostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.makeYourOwnPost(
          input.workspaceId,
          ctx.user.sub,
          input.imageUrl,
          input.websiteUrl,
        )
      }),

    // =========================================================================
    // Legacy — AI Generation
    // =========================================================================

    generateCaption: protectedProcedure
      .input(generateCaptionSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generateCaption(input, ctx.user.sub)
      }),

    generateHashtags: protectedProcedure
      .input(generateHashtagsSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generateHashtags(input, ctx.user.sub)
      }),

    generateContentIdeas: protectedProcedure
      .input(generateContentIdeasSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generateContentIdeas(input, ctx.user.sub)
      }),

    generateImagePrompt: protectedProcedure
      .input(generateImagePromptSchema)
      .mutation(async ({ input, ctx }) => {
        return service.generateImagePrompt(input, ctx.user.sub)
      }),

    // --- CRUD ---

    listPosts: protectedProcedure
      .input(listPostsSchema)
      .query(async ({ input, ctx }) => {
        return service.listPosts(input, ctx.user.sub)
      }),

    createPost: protectedProcedure
      .input(createPostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.createPost(input, ctx.user.sub)
      }),

    updatePost: protectedProcedure
      .input(updatePostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updatePost(input, ctx.user.sub)
      }),

    deletePost: protectedProcedure
      .input(deletePostSchema)
      .mutation(async ({ input, ctx }) => {
        return service.deletePost(input, ctx.user.sub)
      }),

    // --- Brand Voice ---

    getBrandVoice: protectedProcedure
      .input(getBrandVoiceSchema)
      .query(async ({ input, ctx }) => {
        return service.getBrandVoice(input.workspaceId, ctx.user.sub)
      }),

    updateBrandVoice: protectedProcedure
      .input(updateBrandVoiceSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateBrandVoice(input, ctx.user.sub)
      }),

    // --- Calendar ---

    getCalendar: protectedProcedure
      .input(getCalendarSchema)
      .query(async ({ input, ctx }) => {
        return service.getCalendar(
          input.workspaceId,
          input.month,
          input.year,
          ctx.user.sub,
        )
      }),

    // --- Stats ---

    getContentStats: protectedProcedure
      .input(getContentStatsSchema)
      .query(async ({ input, ctx }) => {
        return service.getContentStats(input.workspaceId, ctx.user.sub)
      }),
  })
}
