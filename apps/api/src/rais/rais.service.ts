import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, sql, gte, lte, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import type { Database } from '@rectangled/db'
import {
  socialPosts,
  contentCalendar,
  brandVoice,
  members,
} from '@rectangled/db'

// ---------------------------------------------------------------------------
// OpenRouter AI Client
// ---------------------------------------------------------------------------

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'OptimizerV6 - Rectangled.io rAIS',
  },
})

const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini'

// ---------------------------------------------------------------------------
// Platform Guidelines
// ---------------------------------------------------------------------------

const PLATFORM_GUIDELINES: Record<string, string> = {
  instagram:
    'Instagram: Max 2200 characters. Use engaging, visual language. Encourage saves and shares. Emojis are welcome. Use line breaks for readability.',
  facebook:
    'Facebook: Keep it conversational and shorter (under 500 chars ideal). Questions drive engagement. Links are fine.',
  google:
    'Google Business Profile: Business-focused, informative. Highlight offers, events, or updates. Keep professional. Under 1500 chars.',
  twitter:
    'Twitter/X: Max 280 characters. Be punchy and direct. Use threads for longer content. Hashtags sparingly (1-3).',
  linkedin:
    'LinkedIn: Professional tone. Thought leadership works well. Can be longer (up to 3000 chars). Use bullet points. Minimal emojis.',
}

const CONTENT_TYPE_GUIDELINES: Record<string, string> = {
  post: 'Standard social media post — engaging, informative, drives interaction.',
  story: 'Story-style content — casual, ephemeral feel, call to action, short and punchy.',
  reel_caption: 'Reel/Short video caption — hook in first line, trending style, concise.',
  event: 'Event promotion — include date/time placeholder, urgency, RSVP call to action.',
  offer: 'Special offer/promotion — highlight discount/value, urgency, clear CTA.',
}

@Injectable()
export class RaisService {
  private readonly logger = new Logger(RaisService.name)

  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // AI Generation
  // ---------------------------------------------------------------------------

  async generateCaption(
    input: {
      workspaceId: string
      platform: string
      contentType: string
      topic: string
      tone?: string
      keywords?: string[]
      locationName?: string
      brandVoiceId?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Load brand voice if available
    let brandVoiceContext = ''
    const bv = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, input.workspaceId),
    })
    if (bv) {
      brandVoiceContext = `\nBrand Voice Guidelines:
- Tone: ${bv.tone}
- Keywords to include: ${bv.keywords.join(', ') || 'none specified'}
- Words to avoid: ${bv.avoidWords.join(', ') || 'none specified'}
- Industry: ${bv.industry || 'general'}
${bv.samplePosts.length > 0 ? `- Sample posts for style reference:\n${bv.samplePosts.slice(0, 3).map((p) => `  "${p}"`).join('\n')}` : ''}`
    }

    const systemPrompt = `You are a social media content expert. Generate engaging social media content.

Platform: ${PLATFORM_GUIDELINES[input.platform] || input.platform}
Content Type: ${CONTENT_TYPE_GUIDELINES[input.contentType] || input.contentType}
${input.tone ? `Desired Tone: ${input.tone}` : ''}
${input.keywords?.length ? `Include these keywords naturally: ${input.keywords.join(', ')}` : ''}
${input.locationName ? `Business/Location: ${input.locationName}` : ''}
${brandVoiceContext}

Return a JSON object with:
- "caption": the full post caption text
- "hashtags": array of relevant hashtags (without # symbol), mix of popular and niche (8-15 hashtags)

Return ONLY the JSON object, no markdown code blocks.`

    const response = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a ${input.contentType} about: ${input.topic}` },
      ],
      temperature: 0.8,
    })

    const content = response.choices[0]?.message?.content?.trim() || '{}'
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      const parsed = JSON.parse(cleaned)
      return {
        caption: parsed.caption || '',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      }
    } catch {
      this.logger.warn('Failed to parse AI caption response, returning raw')
      return { caption: content, hashtags: [] }
    }
  }

  async generateHashtags(
    input: {
      workspaceId: string
      topic: string
      platform: string
      count?: number
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const hashtagCount = input.count || 15

    const systemPrompt = `You are a social media hashtag expert. Generate relevant hashtags for the given topic and platform.
Platform: ${input.platform}
Return a JSON object with:
- "hashtags": array of ${hashtagCount} hashtags (without # symbol). Mix of popular (high reach) and niche (targeted) hashtags.

Return ONLY the JSON object, no markdown code blocks.`

    const response = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate hashtags for: ${input.topic}` },
      ],
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim() || '{}'
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      const parsed = JSON.parse(cleaned)
      return { hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [] }
    } catch {
      return { hashtags: [] }
    }
  }

  async generateContentIdeas(
    input: {
      workspaceId: string
      industry: string
      platform: string
      count?: number
      dateRange?: { from: string; to: string }
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const ideaCount = input.count || 5

    const systemPrompt = `You are a social media content strategist. Generate ${ideaCount} content ideas for a ${input.industry} business on ${input.platform}.
${input.dateRange ? `For the period: ${input.dateRange.from} to ${input.dateRange.to}` : ''}

Return a JSON object with:
- "ideas": array of objects with { "title": string, "description": string, "contentType": "post"|"story"|"reel_caption"|"event"|"offer", "bestTime": string (e.g., "Tuesday 10:00 AM") }

Return ONLY the JSON object, no markdown code blocks.`

    const response = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate content ideas for a ${input.industry} business on ${input.platform}.`,
        },
      ],
      temperature: 0.9,
    })

    const content = response.choices[0]?.message?.content?.trim() || '{}'
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      const parsed = JSON.parse(cleaned)
      return { ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [] }
    } catch {
      return { ideas: [] }
    }
  }

  async generateImagePrompt(
    input: {
      workspaceId: string
      caption: string
      platform: string
      style?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const systemPrompt = `You are an AI image prompt engineer. Create a detailed image generation prompt based on the social media caption provided.

Platform: ${input.platform}
${input.style ? `Desired Style: ${input.style}` : 'Style: Modern, professional, eye-catching'}

Return a JSON object with:
- "prompt": detailed image generation prompt (describe scene, colors, composition, style)
- "negativePrompt": things to avoid in the image
- "style": the art style (e.g., "photorealistic", "illustration", "minimalist", "flat design")

Return ONLY the JSON object, no markdown code blocks.`

    const response = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create an image prompt for this caption:\n${input.caption}` },
      ],
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim() || '{}'
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      const parsed = JSON.parse(cleaned)
      return {
        prompt: parsed.prompt || '',
        negativePrompt: parsed.negativePrompt || '',
        style: parsed.style || 'photorealistic',
      }
    } catch {
      return { prompt: content, negativePrompt: '', style: 'photorealistic' }
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async listPosts(
    input: {
      workspaceId: string
      status?: string
      platform?: string
      limit?: number
      offset?: number
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const conditions = [eq(socialPosts.workspaceId, input.workspaceId)]
    if (input.status) {
      conditions.push(eq(socialPosts.status, input.status as any))
    }
    if (input.platform) {
      conditions.push(eq(socialPosts.platform, input.platform as any))
    }

    const rows = await this.db
      .select()
      .from(socialPosts)
      .where(and(...conditions))
      .orderBy(desc(socialPosts.createdAt))
      .limit(input.limit || 20)
      .offset(input.offset || 0)

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(socialPosts)
      .where(and(...conditions))

    return { posts: rows, total: totalResult?.count || 0 }
  }

  async createPost(
    input: {
      workspaceId: string
      platform: string
      contentType: string
      caption: string
      hashtags?: string[]
      imageUrl?: string
      scheduledFor?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const [post] = await this.db
      .insert(socialPosts)
      .values({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        platform: input.platform as any,
        contentType: input.contentType as any,
        caption: input.caption,
        hashtags: input.hashtags || [],
        imageUrl: input.imageUrl,
        status: input.scheduledFor ? ('scheduled' as any) : ('draft' as any),
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        createdBy: userId,
      })
      .returning()

    return post
  }

  async updatePost(
    input: {
      id: string
      workspaceId: string
      caption?: string
      hashtags?: string[]
      scheduledFor?: string | null
      status?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Verify post belongs to workspace
    const existing = await this.db.query.socialPosts.findFirst({
      where: and(
        eq(socialPosts.id, input.id),
        eq(socialPosts.workspaceId, input.workspaceId)
      ),
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' })
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (input.caption !== undefined) updates.caption = input.caption
    if (input.hashtags !== undefined) updates.hashtags = input.hashtags
    if (input.scheduledFor !== undefined) {
      updates.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null
    }
    if (input.status !== undefined) updates.status = input.status

    const [updated] = await this.db
      .update(socialPosts)
      .set(updates)
      .where(eq(socialPosts.id, input.id))
      .returning()

    return updated
  }

  async deletePost(
    input: { id: string; workspaceId: string },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.socialPosts.findFirst({
      where: and(
        eq(socialPosts.id, input.id),
        eq(socialPosts.workspaceId, input.workspaceId)
      ),
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' })
    }

    await this.db.delete(socialPosts).where(eq(socialPosts.id, input.id))
    return { success: true }
  }

  // ---------------------------------------------------------------------------
  // Brand Voice
  // ---------------------------------------------------------------------------

  async getBrandVoice(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const bv = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, workspaceId),
    })

    return (
      bv || {
        id: null,
        workspaceId,
        tone: 'professional',
        keywords: [],
        avoidWords: [],
        samplePosts: [],
        industry: null,
      }
    )
  }

  async updateBrandVoice(
    input: {
      workspaceId: string
      tone: string
      keywords: string[]
      avoidWords: string[]
      samplePosts: string[]
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Upsert
    const existing = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, input.workspaceId),
    })

    if (existing) {
      const [updated] = await this.db
        .update(brandVoice)
        .set({
          tone: input.tone,
          keywords: input.keywords,
          avoidWords: input.avoidWords,
          samplePosts: input.samplePosts,
          updatedAt: new Date(),
        })
        .where(eq(brandVoice.workspaceId, input.workspaceId))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(brandVoice)
      .values({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        tone: input.tone,
        keywords: input.keywords,
        avoidWords: input.avoidWords,
        samplePosts: input.samplePosts,
      })
      .returning()

    return created
  }

  // ---------------------------------------------------------------------------
  // Calendar
  // ---------------------------------------------------------------------------

  async getCalendar(workspaceId: string, month: number, year: number, userId: string) {
    await this.requireMembership(workspaceId, userId)

    // Get all posts scheduled in this month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const scheduledPosts = await this.db
      .select()
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.workspaceId, workspaceId),
          gte(socialPosts.scheduledFor, startDate),
          lte(socialPosts.scheduledFor, endDate)
        )
      )
      .orderBy(socialPosts.scheduledFor)

    // Group by date
    const calendarDays: Record<
      string,
      Array<{
        id: string
        time: string
        platform: string
        caption: string
        status: string
      }>
    > = {}

    for (const post of scheduledPosts) {
      if (!post.scheduledFor) continue
      const dateKey = post.scheduledFor.toISOString().split('T')[0]!
      if (!calendarDays[dateKey]) calendarDays[dateKey] = []
      calendarDays[dateKey]!.push({
        id: post.id,
        time: post.scheduledFor.toISOString(),
        platform: post.platform,
        caption: post.caption.slice(0, 60),
        status: post.status,
      })
    }

    return { month, year, days: calendarDays }
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async getContentStats(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const allPosts = await this.db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.workspaceId, workspaceId))

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const byPlatform: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let thisMonth = 0
    let scheduledCount = 0

    for (const post of allPosts) {
      byPlatform[post.platform] = (byPlatform[post.platform] || 0) + 1
      byStatus[post.status] = (byStatus[post.status] || 0) + 1
      if (post.createdAt >= startOfMonth) thisMonth++
      if (post.status === 'scheduled') scheduledCount++
    }

    return {
      totalPosts: allPosts.length,
      byPlatform,
      byStatus,
      thisMonth,
      scheduledCount,
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Not a member of this workspace',
      })
    }
    return membership
  }
}
