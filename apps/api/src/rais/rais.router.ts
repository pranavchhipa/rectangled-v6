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
} from '@rectangled/shared'
import { RaisService } from './rais.service'

export function createRaisRouter(service: RaisService) {
  return router({
    // --- AI Generation ---

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
          ctx.user.sub
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
