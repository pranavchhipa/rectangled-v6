import { z } from 'zod'

export const socialPlatformSchema = z.enum([
  'instagram',
  'facebook',
  'google',
  'twitter',
  'linkedin',
])

export const contentTypeSchema = z.enum([
  'post',
  'story',
  'reel_caption',
  'event',
  'offer',
])

export const socialPostStatusSchema = z.enum([
  'draft',
  'scheduled',
  'published',
  'failed',
])

// --- AI Generation ---

export const generateCaptionSchema = z.object({
  workspaceId: z.string().uuid(),
  platform: socialPlatformSchema,
  contentType: contentTypeSchema,
  topic: z.string().min(3).max(1000),
  tone: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  locationName: z.string().optional(),
  brandVoiceId: z.string().uuid().optional(),
})

export const generateHashtagsSchema = z.object({
  workspaceId: z.string().uuid(),
  topic: z.string().min(3).max(500),
  platform: socialPlatformSchema,
  count: z.number().int().min(5).max(30).default(15),
})

export const generateContentIdeasSchema = z.object({
  workspaceId: z.string().uuid(),
  industry: z.string().min(2).max(100),
  platform: socialPlatformSchema,
  count: z.number().int().min(3).max(10).default(5),
  dateRange: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
})

export const generateImagePromptSchema = z.object({
  workspaceId: z.string().uuid(),
  caption: z.string().min(3).max(2000),
  platform: socialPlatformSchema,
  style: z.string().optional(),
})

// --- CRUD ---

export const listPostsSchema = z.object({
  workspaceId: z.string().uuid(),
  status: socialPostStatusSchema.optional(),
  platform: socialPlatformSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export const createPostSchema = z.object({
  workspaceId: z.string().uuid(),
  platform: socialPlatformSchema,
  contentType: contentTypeSchema,
  caption: z.string().min(1).max(5000),
  hashtags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
  scheduledFor: z.string().datetime().optional(),
})

export const updatePostSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  caption: z.string().min(1).max(5000).optional(),
  hashtags: z.array(z.string()).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  status: socialPostStatusSchema.optional(),
})

export const deletePostSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
})

// --- Brand Voice ---

export const getBrandVoiceSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const updateBrandVoiceSchema = z.object({
  workspaceId: z.string().uuid(),
  tone: z.string().min(1).max(50),
  keywords: z.array(z.string()).default([]),
  avoidWords: z.array(z.string()).default([]),
  samplePosts: z.array(z.string()).default([]),
})

// --- Calendar ---

export const getCalendarSchema = z.object({
  workspaceId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
})

// --- Stats ---

export const getContentStatsSchema = z.object({
  workspaceId: z.string().uuid(),
})
