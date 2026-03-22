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
  reviews,
  raisCredits,
  raisCreditLog,
  raisAnalysis,
  raisPostIdeas,
  raisGeneratedPosts,
} from '@rectangled/db'

// ---------------------------------------------------------------------------
// OpenRouter AI Client (lazy-initialized to ensure env vars are loaded)
// ---------------------------------------------------------------------------

let _openrouter: OpenAI | null = null
function getOpenRouter(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'OptimizerV6 - Rectangled.io rAIS',
      },
    })
  }
  return _openrouter
}

// ---------------------------------------------------------------------------
// Credit Costs
// ---------------------------------------------------------------------------

const CREDIT_COSTS = {
  review_analysis: 0.05, // per review
  post_generation: 2.0,
  image_generation: 1.0,
  text_generation: 0.2, // title, description, hashtag regen
  offer_generation: 2.0,
} as const

// ---------------------------------------------------------------------------
// Multi-Model AI Config
// ---------------------------------------------------------------------------

const MODEL_MAP = {
  review_analytics: { primary: 'google/gemini-2.0-flash-001', fallback: 'openai/gpt-4o-mini' },
  image_generation: { primary: 'google/gemini-2.0-flash-001', fallback: 'openai/gpt-4o-mini' },
  title_generation: { primary: 'google/gemini-2.0-flash-001', fallback: 'openai/gpt-4o-mini' },
  hashtag_generation: { primary: 'google/gemini-2.0-flash-001', fallback: 'openai/gpt-4o-mini' },
  description_generation: { primary: 'google/gemini-2.0-flash-001', fallback: 'openai/gpt-4o-mini' },
  offer_generation: { primary: 'google/gemini-2.0-flash-001', fallback: 'openai/gpt-4o-mini' },
} as const

type AIPurpose = keyof typeof MODEL_MAP

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
  // Multi-Model AI Caller
  // ---------------------------------------------------------------------------

  private async callAI(params: {
    purpose: AIPurpose
    systemPrompt: string
    userPrompt: string
    temperature?: number
    maxTokens?: number
  }): Promise<string> {
    const models = MODEL_MAP[params.purpose]

    // Try primary model first
    try {
      const response = await getOpenRouter().chat.completions.create({
        model: models.primary,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens || 2048,
      })
      const content = response.choices[0]?.message?.content?.trim()
      if (!content) throw new Error('Empty response from primary model')
      return content
    } catch (primaryErr) {
      this.logger.warn(
        `Primary model ${models.primary} failed for ${params.purpose}, trying fallback ${models.fallback}`,
        (primaryErr as Error).message,
      )
    }

    // Fallback model
    try {
      const response = await getOpenRouter().chat.completions.create({
        model: models.fallback,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens || 2048,
      })
      const content = response.choices[0]?.message?.content?.trim()
      if (!content) throw new Error('Empty response from fallback model')
      return content
    } catch (fallbackErr) {
      this.logger.error(
        `Fallback model ${models.fallback} also failed for ${params.purpose}`,
        fallbackErr,
      )
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'AI service temporarily unavailable. Please try again.',
      })
    }
  }

  private parseJSON<T = any>(raw: string): T {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    return JSON.parse(cleaned)
  }

  // ---------------------------------------------------------------------------
  // Credit System
  // ---------------------------------------------------------------------------

  async getCredits(workspaceId: string) {
    let credit = await this.db.query.raisCredits.findFirst({
      where: eq(raisCredits.workspaceId, workspaceId),
    })

    if (!credit) {
      // Auto-create with 100 credits
      const [created] = await this.db
        .insert(raisCredits)
        .values({
          id: randomUUID(),
          workspaceId,
          totalCredits: 100,
          usedCredits: 0,
        })
        .returning()
      credit = created!
    }

    return {
      total: credit.totalCredits,
      used: credit.usedCredits,
      remaining: credit.totalCredits - credit.usedCredits,
    }
  }

  async deductCredits(
    workspaceId: string,
    action: string,
    amount: number,
    description: string,
  ) {
    const credits = await this.getCredits(workspaceId)

    if (credits.remaining < amount) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient credits. You need ${amount.toFixed(1)} credits but only have ${credits.remaining.toFixed(1)} remaining. Please upgrade your plan or wait for a reset.`,
      })
    }

    // Deduct
    await this.db
      .update(raisCredits)
      .set({
        usedCredits: sql`${raisCredits.usedCredits} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(raisCredits.workspaceId, workspaceId))

    // Log transaction
    await this.db.insert(raisCreditLog).values({
      id: randomUUID(),
      workspaceId,
      action,
      creditsUsed: amount,
      description,
    })
  }

  async getCreditLog(workspaceId: string, limit: number = 20) {
    return this.db
      .select()
      .from(raisCreditLog)
      .where(eq(raisCreditLog.workspaceId, workspaceId))
      .orderBy(desc(raisCreditLog.createdAt))
      .limit(limit)
  }

  // ---------------------------------------------------------------------------
  // Step 1: Analyze Reviews
  // ---------------------------------------------------------------------------

  async analyzeReviews(
    workspaceId: string,
    userId: string,
    locationId?: string,
    periodMonths: number = 3,
  ) {
    await this.requireMembership(workspaceId, userId)

    // Calculate date range
    const now = new Date()
    const startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - periodMonths)

    // Fetch reviews
    const conditions = [
      eq(reviews.workspaceId, workspaceId),
      gte(reviews.reviewedAt, startDate),
    ]
    if (locationId) {
      conditions.push(eq(reviews.locationId, locationId))
    }

    const reviewRows = await this.db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(desc(reviews.reviewedAt))

    if (reviewRows.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No reviews found in the last ${periodMonths} month(s). Try a longer period.`,
      })
    }

    // Calculate credit cost
    const creditCost = reviewRows.length * CREDIT_COSTS.review_analysis
    await this.deductCredits(
      workspaceId,
      'review_analysis',
      creditCost,
      `Analyzed ${reviewRows.length} reviews (${periodMonths}mo period)`,
    )

    // Build review text for AI
    const reviewTexts = reviewRows
      .filter((r) => r.text)
      .map((r) => `[${r.rating}★] ${r.text}`)
      .join('\n')

    const systemPrompt = `You are a business intelligence analyst specializing in customer feedback analysis.
Analyze the following customer reviews and extract actionable insights.

Return a JSON object with:
- "positiveAspects": array of { "aspect": string, "count": number, "sentiment": number (0-1), "sampleReviews": string[] (max 3 short quotes) }
- "topThemes": array of { "theme": string, "frequency": number, "keywords": string[] }
- "overallSentiment": number between -1 and 1
- "aiSummary": a 2-3 sentence summary of the key findings

Focus on POSITIVE aspects that can be leveraged for marketing content.
Return ONLY the JSON object, no markdown code blocks.`

    const aiResponse = await this.callAI({
      purpose: 'review_analytics',
      systemPrompt,
      userPrompt: `Analyze these ${reviewRows.length} customer reviews:\n\n${reviewTexts}`,
      temperature: 0.3,
    })

    let parsed: any
    try {
      parsed = this.parseJSON(aiResponse)
    } catch {
      this.logger.warn('Failed to parse review analysis AI response')
      parsed = {
        positiveAspects: [],
        topThemes: [],
        overallSentiment: 0,
        aiSummary: 'Analysis could not be parsed. Please try again.',
      }
    }

    // Save analysis
    const [analysis] = await this.db
      .insert(raisAnalysis)
      .values({
        id: randomUUID(),
        workspaceId,
        locationId: locationId || null,
        periodMonths,
        reviewsAnalyzed: reviewRows.length,
        positiveAspects: parsed.positiveAspects || [],
        topThemes: parsed.topThemes || [],
        overallSentiment: parsed.overallSentiment || 0,
        aiSummary: parsed.aiSummary || '',
      })
      .returning()

    return analysis
  }

  // ---------------------------------------------------------------------------
  // Step 2: Generate Post Ideas
  // ---------------------------------------------------------------------------

  async generatePostIdeas(workspaceId: string, userId: string, analysisId: string) {
    await this.requireMembership(workspaceId, userId)

    // Load the analysis
    const analysis = await this.db.query.raisAnalysis.findFirst({
      where: and(
        eq(raisAnalysis.id, analysisId),
        eq(raisAnalysis.workspaceId, workspaceId),
      ),
    })
    if (!analysis) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Analysis not found' })
    }

    // Deduct credits
    await this.deductCredits(
      workspaceId,
      'post_generation',
      CREDIT_COSTS.post_generation,
      'Generated 5 viral post ideas from review analysis',
    )

    // Load brand voice context
    let brandVoiceContext = ''
    const bv = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, workspaceId),
    })
    if (bv) {
      brandVoiceContext = `\nBrand Voice: Tone=${bv.tone}, Industry=${bv.industry || 'general'}, Keywords=${bv.keywords.join(', ') || 'none'}`
    }

    const positiveAspects = (analysis.positiveAspects as any[]) || []
    const themes = (analysis.topThemes as any[]) || []

    const systemPrompt = `You are a viral social media content strategist. Based on real customer review insights, generate 5 compelling post ideas that leverage positive customer feedback for marketing.
${brandVoiceContext}

Return a JSON object with:
- "ideas": array of 5 objects, each with:
  - "title": catchy post title (max 100 chars)
  - "subtitle": supporting line (max 150 chars)
  - "description": full post concept description (2-3 sentences)
  - "hashtags": array of 5-8 relevant hashtags (without #)
  - "viralityAngle": why this could go viral (1 sentence)
  - "targetPlatform": best platform for this idea ("instagram"|"facebook"|"linkedin"|"twitter"|"google")

Return ONLY the JSON object, no markdown code blocks.`

    const userPrompt = `Customer review insights:
Positive Aspects: ${JSON.stringify(positiveAspects.slice(0, 8))}
Top Themes: ${JSON.stringify(themes.slice(0, 6))}
Overall Sentiment: ${analysis.overallSentiment}
Summary: ${analysis.aiSummary}

Generate 5 viral-worthy post ideas that leverage these positive customer experiences.`

    const aiResponse = await this.callAI({
      purpose: 'title_generation',
      systemPrompt,
      userPrompt,
      temperature: 0.9,
    })

    let parsed: any
    try {
      parsed = this.parseJSON(aiResponse)
    } catch {
      parsed = { ideas: [] }
    }

    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : []

    // Save ideas
    const [saved] = await this.db
      .insert(raisPostIdeas)
      .values({
        id: randomUUID(),
        analysisId,
        workspaceId,
        ideas,
      })
      .returning()

    return saved
  }

  // ---------------------------------------------------------------------------
  // Step 3: Generate Post (two options)
  // ---------------------------------------------------------------------------

  async generatePost(
    workspaceId: string,
    userId: string,
    ideaIndex: number,
    analysisId: string,
  ) {
    await this.requireMembership(workspaceId, userId)

    // Load ideas
    const ideaRecord = await this.db.query.raisPostIdeas.findFirst({
      where: and(
        eq(raisPostIdeas.workspaceId, workspaceId),
        eq(raisPostIdeas.analysisId, analysisId),
      ),
    })
    if (!ideaRecord) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post ideas not found' })
    }

    const ideas = (ideaRecord.ideas as any[]) || []
    if (ideaIndex >= ideas.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid idea index' })
    }

    const selectedIdea = ideas[ideaIndex]!

    // Deduct credits for two options: 2 images (2.0) + 2 titles (0.4) + 2 descriptions (0.4) + 2 hashtags (0.4) = 3.2
    const totalCost =
      CREDIT_COSTS.image_generation * 2 +
      CREDIT_COSTS.text_generation * 2 +
      CREDIT_COSTS.text_generation * 2 +
      CREDIT_COSTS.text_generation * 2
    await this.deductCredits(
      workspaceId,
      'post_generation',
      totalCost,
      `Generated 2 post options for: ${selectedIdea.title}`,
    )

    // Load brand voice
    const bv = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, workspaceId),
    })
    const brandCtx = bv ? `Tone: ${bv.tone}. Industry: ${bv.industry || 'general'}.` : ''

    const generatedPosts = []

    for (let option = 0; option < 2; option++) {
      const variant = option === 0 ? 'professional and polished' : 'bold and attention-grabbing'

      // Generate image prompt
      const imagePromptResponse = await this.callAI({
        purpose: 'image_generation',
        systemPrompt: `Generate a SHORT 8-12 word image description for a social media post. Be VERY specific and concrete about the actual product/food/service shown. ${brandCtx}
Example good prompts: "vibrant Indian thali butter chicken naan rice professional photography", "cozy restaurant interior warm lighting family dining", "steaming masala chai in clay cup with snacks"
Return a JSON with: { "prompt": "8-12 word concrete image description" }
Return ONLY the JSON, no markdown.`,
        userPrompt: `Post idea: ${selectedIdea.title} - ${selectedIdea.description}`,
        temperature: 0.8,
      })
      let imagePrompt = ''
      try {
        const p = this.parseJSON(imagePromptResponse)
        imagePrompt = p.prompt || imagePromptResponse
      } catch {
        imagePrompt = imagePromptResponse
      }

      // Generate title
      const titleResponse = await this.callAI({
        purpose: 'title_generation',
        systemPrompt: `You are a social media copywriter. Write a ${variant} post title/headline. ${brandCtx}
Return a JSON with: { "title": "the title text" }
Return ONLY the JSON, no markdown.`,
        userPrompt: `Original idea: ${selectedIdea.title}\nContext: ${selectedIdea.description}\nPlatform: ${selectedIdea.targetPlatform}`,
        temperature: 0.8,
      })
      let title = selectedIdea.title
      try {
        const t = this.parseJSON(titleResponse)
        title = t.title || title
      } catch {}

      // Generate description
      const descResponse = await this.callAI({
        purpose: 'description_generation',
        systemPrompt: `You are a social media copywriter. Write a ${variant} post caption/description for ${selectedIdea.targetPlatform}. ${brandCtx}
${PLATFORM_GUIDELINES[selectedIdea.targetPlatform] || ''}
Return a JSON with: { "description": "the full post caption text" }
Return ONLY the JSON, no markdown.`,
        userPrompt: `Title: ${title}\nIdea: ${selectedIdea.description}\nVirality angle: ${selectedIdea.viralityAngle}`,
        temperature: 0.8,
      })
      let description = selectedIdea.description
      try {
        const d = this.parseJSON(descResponse)
        description = d.description || description
      } catch {}

      // Generate hashtags
      const hashtagResponse = await this.callAI({
        purpose: 'hashtag_generation',
        systemPrompt: `You are a social media hashtag strategist. Generate a mix of trending, niche, and branded hashtags for ${selectedIdea.targetPlatform}.
Return a JSON with: { "hashtags": ["tag1", "tag2", ...] } (without # symbol, 8-15 hashtags)
Return ONLY the JSON, no markdown.`,
        userPrompt: `Post about: ${title}\n${description}`,
        temperature: 0.7,
      })
      let hashtags = selectedIdea.hashtags || []
      try {
        const h = this.parseJSON(hashtagResponse)
        hashtags = Array.isArray(h.hashtags) ? h.hashtags : hashtags
      } catch {}

      // Generate image URL — use Pollinations AI with the image prompt
      const shortPrompt = (imagePrompt || title || 'food restaurant')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')  // remove special chars
        .replace(/\s+/g, ' ')            // collapse whitespace
        .trim()
        .split(' ')
        .slice(0, 12)                    // max 12 words for reliable generation
        .join(' ')
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(shortPrompt)}?width=1080&height=1080&nologo=true&seed=${Date.now()}`

      // Save generated post
      const [post] = await this.db
        .insert(raisGeneratedPosts)
        .values({
          id: randomUUID(),
          workspaceId,
          ideaId: ideaRecord.id,
          imagePrompt,
          imageUrl,
          title,
          description,
          hashtags,
          platform: selectedIdea.targetPlatform || 'instagram',
          status: 'draft',
        })
        .returning()

      generatedPosts.push(post)
    }

    return generatedPosts
  }

  // ---------------------------------------------------------------------------
  // Step 4: Regenerate Individual Element
  // ---------------------------------------------------------------------------

  async regenerateElement(
    workspaceId: string,
    userId: string,
    postId: string,
    element: 'image' | 'title' | 'description' | 'hashtags' | 'offer',
  ) {
    await this.requireMembership(workspaceId, userId)

    const post = await this.db.query.raisGeneratedPosts.findFirst({
      where: and(
        eq(raisGeneratedPosts.id, postId),
        eq(raisGeneratedPosts.workspaceId, workspaceId),
      ),
    })
    if (!post) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Generated post not found' })
    }

    // Load brand voice
    const bv = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, workspaceId),
    })
    const brandCtx = bv ? `Tone: ${bv.tone}. Industry: ${bv.industry || 'general'}.` : ''

    const updates: Record<string, any> = { updatedAt: new Date() }

    switch (element) {
      case 'image': {
        await this.deductCredits(workspaceId, 'image_generation', CREDIT_COSTS.image_generation, `Regenerated image for: ${post.title}`)
        const response = await this.callAI({
          purpose: 'image_generation',
          systemPrompt: `You are an AI image prompt engineer. Create a completely NEW and different image prompt for a social media post. ${brandCtx}
Return a JSON with: { "prompt": "detailed image description" }
Return ONLY the JSON, no markdown.`,
          userPrompt: `Post title: ${post.title}\nPost description: ${post.description}\nPlatform: ${post.platform}\n\nPrevious prompt (make something DIFFERENT): ${post.imagePrompt}`,
          temperature: 0.9,
        })
        try {
          const p = this.parseJSON(response)
          updates.imagePrompt = p.prompt || response
        } catch {
          updates.imagePrompt = response
        }
        // Generate new image URL from new prompt
        const newPrompt = (updates.imagePrompt || post.title || 'food restaurant')
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .slice(0, 12)
          .join(' ')
        updates.imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(newPrompt)}?width=1080&height=1080&nologo=true&seed=${Date.now()}`
        break
      }
      case 'title': {
        await this.deductCredits(workspaceId, 'text_generation', CREDIT_COSTS.text_generation, `Regenerated title for post`)
        const response = await this.callAI({
          purpose: 'title_generation',
          systemPrompt: `You are a social media copywriter. Write a fresh, different title/headline. ${brandCtx}
Return a JSON with: { "title": "new title text" }
Return ONLY the JSON, no markdown.`,
          userPrompt: `Current title (write something DIFFERENT): ${post.title}\nDescription: ${post.description}\nPlatform: ${post.platform}`,
          temperature: 0.9,
        })
        try {
          const t = this.parseJSON(response)
          updates.title = t.title || post.title
        } catch {}
        break
      }
      case 'description': {
        await this.deductCredits(workspaceId, 'text_generation', CREDIT_COSTS.text_generation, `Regenerated description for post`)
        const response = await this.callAI({
          purpose: 'description_generation',
          systemPrompt: `You are a social media copywriter. Write a fresh, different post caption. ${brandCtx}
${PLATFORM_GUIDELINES[post.platform] || ''}
Return a JSON with: { "description": "new caption text" }
Return ONLY the JSON, no markdown.`,
          userPrompt: `Title: ${post.title}\nCurrent description (write something DIFFERENT): ${post.description}\nPlatform: ${post.platform}`,
          temperature: 0.9,
        })
        try {
          const d = this.parseJSON(response)
          updates.description = d.description || post.description
        } catch {}
        break
      }
      case 'hashtags': {
        await this.deductCredits(workspaceId, 'text_generation', CREDIT_COSTS.text_generation, `Regenerated hashtags for post`)
        const response = await this.callAI({
          purpose: 'hashtag_generation',
          systemPrompt: `You are a hashtag strategist. Generate a completely new set of hashtags.
Return a JSON with: { "hashtags": ["tag1", "tag2", ...] } (without #, 8-15 hashtags)
Return ONLY the JSON, no markdown.`,
          userPrompt: `Post: ${post.title}\n${post.description}\nPlatform: ${post.platform}\nPrevious hashtags (make DIFFERENT): ${(post.hashtags || []).join(', ')}`,
          temperature: 0.9,
        })
        try {
          const h = this.parseJSON(response)
          if (Array.isArray(h.hashtags)) updates.hashtags = h.hashtags
        } catch {}
        break
      }
      case 'offer': {
        await this.deductCredits(workspaceId, 'offer_generation', CREDIT_COSTS.offer_generation, `Generated offer for post`)
        const response = await this.callAI({
          purpose: 'offer_generation',
          systemPrompt: `You are a marketing offer strategist. Create a compelling limited-time offer or promotion based on the post context. ${brandCtx}
Return a JSON with: { "title": "offer headline", "description": "offer details with CTA" }
Return ONLY the JSON, no markdown.`,
          userPrompt: `Post title: ${post.title}\nPost description: ${post.description}\nPlatform: ${post.platform}`,
          temperature: 0.8,
        })
        try {
          const o = this.parseJSON(response)
          updates.title = o.title || post.title
          updates.description = o.description || post.description
        } catch {}
        break
      }
    }

    const [updated] = await this.db
      .update(raisGeneratedPosts)
      .set(updates)
      .where(eq(raisGeneratedPosts.id, postId))
      .returning()

    return updated
  }

  // ---------------------------------------------------------------------------
  // Step 5: Schedule & Trends
  // ---------------------------------------------------------------------------

  async schedulePost(
    workspaceId: string,
    postId: string,
    scheduledFor: Date,
    platform: string,
  ) {
    const [updated] = await this.db
      .update(raisGeneratedPosts)
      .set({
        scheduledFor,
        platform,
        status: 'scheduled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(raisGeneratedPosts.id, postId),
          eq(raisGeneratedPosts.workspaceId, workspaceId),
        ),
      )
      .returning()

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' })
    }

    return updated
  }

  async getRecentTrends(workspaceId: string, userId: string, country: string) {
    await this.requireMembership(workspaceId, userId)

    const response = await this.callAI({
      purpose: 'title_generation',
      systemPrompt: `You are a social media trends analyst. Identify the top 10 currently trending topics, hashtags, and content formats for businesses in ${country}.

Return a JSON with:
- "trends": array of { "topic": string, "description": string, "relevantPlatforms": string[], "trendingHashtags": string[] }
- "updatedAt": current date string

Return ONLY the JSON, no markdown.`,
      userPrompt: `What are the hottest social media trends right now in ${country} for local businesses? Focus on actionable trends they can leverage.`,
      temperature: 0.7,
    })

    try {
      return this.parseJSON(response)
    } catch {
      return { trends: [], updatedAt: new Date().toISOString() }
    }
  }

  async getIndustryOpportunities(workspaceId: string, userId: string, industry: string) {
    await this.requireMembership(workspaceId, userId)

    const response = await this.callAI({
      purpose: 'title_generation',
      systemPrompt: `You are a business growth strategist specializing in social media marketing. Provide 5 actionable growth insights for a ${industry} business.

Return a JSON with:
- "opportunities": array of 5 objects with { "title": string, "description": string, "actionSteps": string[], "expectedImpact": string, "difficulty": "easy"|"medium"|"hard" }

Return ONLY the JSON, no markdown.`,
      userPrompt: `What are the top 5 growth opportunities for a ${industry} business on social media right now?`,
      temperature: 0.8,
    })

    try {
      return this.parseJSON(response)
    } catch {
      return { opportunities: [] }
    }
  }

  // ---------------------------------------------------------------------------
  // Part C: Make Your Own Post
  // ---------------------------------------------------------------------------

  async makeYourOwnPost(
    workspaceId: string,
    userId: string,
    imageUrl: string,
    websiteUrl?: string,
  ) {
    await this.requireMembership(workspaceId, userId)

    // Deduct credits (2.0 for post + 1.0 for image)
    await this.deductCredits(
      workspaceId,
      'post_generation',
      CREDIT_COSTS.post_generation + CREDIT_COSTS.image_generation,
      `Make Your Own Post${websiteUrl ? ` (with website: ${websiteUrl})` : ''}`,
    )

    // Load brand voice
    const bv = await this.db.query.brandVoice.findFirst({
      where: eq(brandVoice.workspaceId, workspaceId),
    })
    const brandCtx = bv
      ? `Brand tone: ${bv.tone}. Industry: ${bv.industry || 'general'}. Keywords: ${bv.keywords.join(', ') || 'none'}.`
      : ''

    let websiteContext = ''
    if (websiteUrl) {
      websiteContext = `\nThe user also provided their website URL: ${websiteUrl}. Use this to understand their business and tailor the content appropriately.`
    }

    const systemPrompt = `You are an expert social media marketing creative director. Based on an uploaded image and optional website context, create a complete marketing post package.
${brandCtx}
${websiteContext}

Return a JSON with:
- "imagePrompt": a hero-style enhanced image generation prompt that builds on the uploaded image concept (detailed, vivid, marketing-optimized)
- "title": catchy post headline (max 100 chars)
- "description": full post caption with emojis, line breaks, CTA (platform-optimized)
- "hashtags": array of 10-15 relevant hashtags (without #)
- "platform": best platform recommendation ("instagram"|"facebook"|"linkedin"|"twitter"|"google")
- "aiRecommendedTime": best time to post (e.g., "Wednesday 6:00 PM")

Return ONLY the JSON, no markdown.`

    const response = await this.callAI({
      purpose: 'description_generation',
      systemPrompt,
      userPrompt: `Create a complete marketing post based on this uploaded image: ${imageUrl}${websiteUrl ? `\nWebsite: ${websiteUrl}` : ''}`,
      temperature: 0.8,
    })

    let parsed: any
    try {
      parsed = this.parseJSON(response)
    } catch {
      parsed = {
        imagePrompt: '',
        title: 'Your Marketing Post',
        description: '',
        hashtags: [],
        platform: 'instagram',
        aiRecommendedTime: 'Weekday evenings',
      }
    }

    // Save as generated post
    const [post] = await this.db
      .insert(raisGeneratedPosts)
      .values({
        id: randomUUID(),
        workspaceId,
        imageUrl,
        imagePrompt: parsed.imagePrompt || '',
        title: parsed.title || 'Your Marketing Post',
        description: parsed.description || '',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        platform: parsed.platform || 'instagram',
        status: 'draft',
        aiRecommendedTime: parsed.aiRecommendedTime || null,
      })
      .returning()

    return post
  }

  // ---------------------------------------------------------------------------
  // Legacy AI Generation (kept for backward compat)
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
    userId: string,
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

    const content = await this.callAI({
      purpose: 'description_generation',
      systemPrompt,
      userPrompt: `Create a ${input.contentType} about: ${input.topic}`,
      temperature: 0.8,
    })

    try {
      const parsed = this.parseJSON(content)
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
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const hashtagCount = input.count || 15

    const systemPrompt = `You are a social media hashtag expert. Generate relevant hashtags for the given topic and platform.
Platform: ${input.platform}
Return a JSON object with:
- "hashtags": array of ${hashtagCount} hashtags (without # symbol). Mix of popular (high reach) and niche (targeted) hashtags.

Return ONLY the JSON object, no markdown code blocks.`

    const content = await this.callAI({
      purpose: 'hashtag_generation',
      systemPrompt,
      userPrompt: `Generate hashtags for: ${input.topic}`,
      temperature: 0.7,
    })

    try {
      const parsed = this.parseJSON(content)
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
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const ideaCount = input.count || 5

    const systemPrompt = `You are a social media content strategist. Generate ${ideaCount} content ideas for a ${input.industry} business on ${input.platform}.
${input.dateRange ? `For the period: ${input.dateRange.from} to ${input.dateRange.to}` : ''}

Return a JSON object with:
- "ideas": array of objects with { "title": string, "description": string, "contentType": "post"|"story"|"reel_caption"|"event"|"offer", "bestTime": string (e.g., "Tuesday 10:00 AM") }

Return ONLY the JSON object, no markdown code blocks.`

    const content = await this.callAI({
      purpose: 'title_generation',
      systemPrompt,
      userPrompt: `Generate content ideas for a ${input.industry} business on ${input.platform}.`,
      temperature: 0.9,
    })

    try {
      const parsed = this.parseJSON(content)
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
    userId: string,
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

    const content = await this.callAI({
      purpose: 'image_generation',
      systemPrompt,
      userPrompt: `Create an image prompt for this caption:\n${input.caption}`,
      temperature: 0.7,
    })

    try {
      const parsed = this.parseJSON(content)
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
    userId: string,
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
    userId: string,
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
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.socialPosts.findFirst({
      where: and(
        eq(socialPosts.id, input.id),
        eq(socialPosts.workspaceId, input.workspaceId),
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

  async deletePost(input: { id: string; workspaceId: string }, userId: string) {
    await this.requireMembership(input.workspaceId, userId)

    const existing = await this.db.query.socialPosts.findFirst({
      where: and(
        eq(socialPosts.id, input.id),
        eq(socialPosts.workspaceId, input.workspaceId),
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
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

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

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const scheduledPosts = await this.db
      .select()
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.workspaceId, workspaceId),
          gte(socialPosts.scheduledFor, startDate),
          lte(socialPosts.scheduledFor, endDate),
        ),
      )
      .orderBy(socialPosts.scheduledFor)

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
