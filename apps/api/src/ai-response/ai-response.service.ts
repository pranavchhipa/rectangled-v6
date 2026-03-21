import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { randomUUID } from 'crypto'
import { eq, and, gte, lte, sql, desc, isNotNull } from 'drizzle-orm'
import OpenAI from 'openai'
import type { Database } from '@rectangled/db'
import {
  reviews,
  reviewResponses,
  aiResponseSchedules,
  aiResponseDailyCounts,
  members,
  workspaces,
} from '@rectangled/db'

// ---------------------------------------------------------------------------
// OpenRouter AI Client
// ---------------------------------------------------------------------------

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'OptimizerV6 - Rectangled.io',
  },
})

const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini'

// ---------------------------------------------------------------------------
// Tone Presets
// ---------------------------------------------------------------------------

const TONE_PRESETS = {
  professional: {
    greetings: [
      'Thank you for your review',
      'We appreciate your feedback',
      'Thank you for taking the time to share your thoughts',
      'We value your detailed feedback',
      'Thank you for bringing this to our attention',
    ],
    closings: [
      'Best regards',
      'Warm regards',
      'Thank you for choosing us',
      'We look forward to serving you again',
      'With appreciation',
    ],
    style: 'formal' as const,
  },
  friendly: {
    greetings: [
      'Hey there! Thanks for the review',
      'So glad you shared your experience',
      'Thanks a bunch for the feedback',
      'Really appreciate you taking the time',
      'Thanks for letting us know',
    ],
    closings: [
      'Cheers!',
      'See you soon!',
      'Thanks again!',
      'Hope to see you back soon',
      'Take care!',
    ],
    style: 'casual' as const,
  },
  empathetic: {
    greetings: [
      'We truly appreciate you sharing this',
      'Thank you for being honest with us',
      'We hear you',
      'We appreciate your candid feedback',
      'Thank you for letting us know how you feel',
    ],
    closings: [
      "We're here for you",
      'Your satisfaction matters to us',
      "We're committed to doing better",
      'Please know we take this seriously',
      'We genuinely care about your experience',
    ],
    style: 'caring' as const,
  },
  witty: {
    greetings: [
      'Well, you certainly got our attention!',
      'Thanks for keeping us on our toes',
      'Your review made our day',
      'Now THIS is the kind of feedback we live for',
      "We couldn't help but smile reading this",
    ],
    closings: [
      'Until next time!',
      'Looking forward to wowing you again',
      'Stay awesome!',
      "Can't wait to see you back",
      'Keep being amazing!',
    ],
    style: 'playful' as const,
  },
} as const

type TonePresetKey = keyof typeof TONE_PRESETS

// ---------------------------------------------------------------------------
// Human Imitation Protocol helpers
// ---------------------------------------------------------------------------

const GREETINGS_POSITIVE = TONE_PRESETS.professional.greetings
const GREETINGS_NEGATIVE = [
  'Thank you for sharing your feedback with us.',
  'We appreciate you letting us know about this.',
  'Thank you for bringing this to our attention.',
  "We're sorry to hear about your experience.",
  'We appreciate your honest feedback.',
]

const CLOSINGS = TONE_PRESETS.professional.closings
const CLOSINGS_NEGATIVE = [
  'We hope to have the chance to make it right.',
  "Please don't hesitate to reach out directly so we can resolve this.",
  "We're committed to improving and hope you'll give us another chance.",
  'Your feedback helps us improve \u2014 thank you.',
]

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Calculate a human-like delay for response scheduling.
 * Returns delay in minutes with business hours consideration.
 */
function calculateHumanDelay(minDays = 1, maxDays = 7): number {
  // Random delay between minDays and maxDays
  const days = minDays + Math.random() * (maxDays - minDays)
  // Add hour variation (business hours 9am-6pm)
  const hours = 9 + Math.random() * 9
  return Math.floor(days * 24 * 60 + hours * 60)
}

/**
 * Apply sentence variation to make text look more human.
 */
function applySentenceVariation(text: string): string {
  let result = text

  // Occasionally use contractions or expand them
  if (Math.random() < 0.3) {
    const contractionMap: [RegExp, string][] = [
      [/\bwe are\b/gi, "we're"],
      [/\bwe have\b/gi, "we've"],
      [/\bit is\b/gi, "it's"],
      [/\bthat is\b/gi, "that's"],
      [/\bdo not\b/gi, "don't"],
      [/\bcannot\b/gi, "can't"],
      [/\bwill not\b/gi, "won't"],
    ]
    const pair = pickRandom(contractionMap)
    result = result.replace(pair[0], pair[1])
  } else if (Math.random() < 0.2) {
    const expandMap: [RegExp, string][] = [
      [/\bwe're\b/gi, 'we are'],
      [/\bwe've\b/gi, 'we have'],
      [/\bit's\b/gi, 'it is'],
      [/\bdon't\b/gi, 'do not'],
      [/\bcan't\b/gi, 'cannot'],
    ]
    const pair = pickRandom(expandMap)
    result = result.replace(pair[0], pair[1])
  }

  // Occasionally add a double space (human typo pattern)
  if (Math.random() < 0.08) {
    const sentences = result.split('. ')
    if (sentences.length > 1) {
      const idx = Math.floor(Math.random() * (sentences.length - 1))
      sentences[idx] = sentences[idx] + '.'
      result = sentences.join('  ') // double space
    }
  }

  // Occasionally remove a trailing period and re-add (no visible change but varies timing)
  // Occasionally skip a comma after introductory phrases
  if (Math.random() < 0.1) {
    result = result.replace(/^(Hi|Hello|Hey),\s/, '$1 ')
  }

  return result
}

/**
 * Human Imitation Protocol \u2014 vary the generated response to look natural.
 * Supports tone presets for different brand voices.
 */
function humanize(
  review: {
    rating: number
    reviewerName: string | null
    text: string | null
  },
  tonePreset: TonePresetKey = 'professional'
) {
  const tone = TONE_PRESETS[tonePreset] ?? TONE_PRESETS.professional
  const isPositive = review.rating >= 4

  // Select greeting based on tone and sentiment
  let greeting: string
  if (isPositive) {
    greeting = pickRandom(tone.greetings)
  } else {
    // For negative reviews, use empathetic greetings regardless of tone
    const negGreetings = tonePreset === 'empathetic'
      ? tone.greetings
      : GREETINGS_NEGATIVE
    greeting = pickRandom(negGreetings)
  }

  // Select closing
  let closing: string
  if (isPositive) {
    closing = pickRandom(tone.closings)
  } else {
    closing = pickRandom(CLOSINGS_NEGATIVE)
  }

  const name = review.reviewerName
    ? `, ${review.reviewerName.split(' ')[0]}`
    : ''

  // Vary body length and content based on tone style
  let body: string
  if (isPositive) {
    const formalBodies = [
      `We're glad you had a great experience${name}.`,
      `It means a lot to us that you enjoyed your visit${name}. Our team works hard to ensure every guest leaves satisfied.`,
      `Your feedback truly brightens our day${name}! We strive to deliver the best experience possible.`,
      `We're delighted to hear this${name}. Feedback like yours motivates our entire team.`,
    ]
    const casualBodies = [
      `So happy you had a great time${name}!`,
      `That really means a lot to us${name}. We love hearing stuff like this!`,
      `This put a big smile on our faces${name}. You made our day!`,
    ]
    const caringBodies = [
      `Knowing we could make your experience special means everything to us${name}.`,
      `We put our hearts into what we do${name}, and your words validate that effort.`,
      `Your kind words truly touch our team${name}. We cherish every positive experience.`,
    ]
    const playfulBodies = [
      `You just made our entire team do a happy dance${name}!`,
      `Reviews like this are what keep us going${name}. We might frame this one!`,
      `We're blushing over here${name}! Thanks for making our day.`,
    ]

    const bodyMap: Record<string, string[]> = {
      formal: formalBodies,
      casual: casualBodies,
      caring: caringBodies,
      playful: playfulBodies,
    }

    body = pickRandom(bodyMap[tone.style] ?? formalBodies)
  } else {
    const formalBodies = [
      `We're sorry we didn't meet your expectations${name}.`,
      `This isn't the experience we aim to provide${name}. We'd love the opportunity to discuss this further.`,
      `We take your concerns seriously${name} and are reviewing the situation with our team.`,
    ]
    const casualBodies = [
      `Oh no, that's definitely not what we want to hear${name}.`,
      `We're really sorry about that${name}. That's not the vibe we're going for.`,
      `Ugh, sorry about that${name}. We'll look into this right away.`,
    ]
    const caringBodies = [
      `We deeply regret that your experience fell short${name}. Your feelings are completely valid.`,
      `We understand how frustrating this must have been${name}. We want to make things right.`,
      `Your experience matters deeply to us${name}, and we're genuinely sorry we let you down.`,
    ]
    const playfulBodies = [
      `Yikes${name}, that's definitely not our best look. We can do better!`,
      `Well, that's not the review we were hoping for${name}. Time to roll up our sleeves!`,
      `Noted${name}! We're already brainstorming how to turn this around.`,
    ]

    const bodyMap: Record<string, string[]> = {
      formal: formalBodies,
      casual: casualBodies,
      caring: caringBodies,
      playful: playfulBodies,
    }

    body = pickRandom(bodyMap[tone.style] ?? formalBodies)
  }

  let responseText = `${greeting}\n\n${body}\n\n${closing}`

  // Apply human-like sentence variations
  responseText = applySentenceVariation(responseText)

  // Calculate delay with human-like timing
  const delayMinutes = calculateHumanDelay()

  return { responseText, delayMinutes }
}

@Injectable()
export class AiResponseAutomationService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // List scheduled AI responses
  // ---------------------------------------------------------------------------

  async listScheduled(
    workspaceId: string,
    status: string | undefined,
    page: number,
    limit: number,
    userId: string
  ) {
    await this.requireMembership(workspaceId, userId)

    const offset = (page - 1) * limit

    const conditions: any[] = [eq(reviews.workspaceId, workspaceId)]
    if (status) {
      conditions.push(eq(aiResponseSchedules.status, status))
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: aiResponseSchedules.id,
          reviewId: aiResponseSchedules.reviewId,
          scheduledFor: aiResponseSchedules.scheduledFor,
          status: aiResponseSchedules.status,
          attempts: aiResponseSchedules.attempts,
          errorMessage: aiResponseSchedules.errorMessage,
          createdAt: aiResponseSchedules.createdAt,
          reviewerName: reviews.reviewerName,
          rating: reviews.rating,
          platform: reviews.platform,
          reviewText: reviews.text,
        })
        .from(aiResponseSchedules)
        .innerJoin(reviews, eq(aiResponseSchedules.reviewId, reviews.id))
        .where(where)
        .orderBy(desc(aiResponseSchedules.scheduledFor))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiResponseSchedules)
        .innerJoin(reviews, eq(aiResponseSchedules.reviewId, reviews.id))
        .where(where),
    ])

    const total = countResult[0]?.count ?? 0

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Generate an AI response with tone preset support
  // ---------------------------------------------------------------------------

  async generateResponse(reviewId: string, userId: string) {
    const logger = new Logger('AiResponse')

    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    await this.requireMembership(review.workspaceId, userId)

    // Fetch workspace tone preset and business name
    const tonePreset = await this.getWorkspaceTonePreset(review.workspaceId)
    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, review.workspaceId),
    })
    const businessName = workspace?.name || 'our business'

    // Try AI generation first, fall back to template
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const tone = TONE_PRESETS[tonePreset] ?? TONE_PRESETS.professional
        const toneDesc = tonePreset === 'professional' ? 'professional and polished'
          : tonePreset === 'friendly' ? 'warm, friendly and casual'
          : tonePreset === 'empathetic' ? 'deeply empathetic and caring'
          : 'witty and light-hearted but respectful'

        const systemPrompt = `You are a review response writer for "${businessName}". Write responses that sound like a real human business owner, NOT like an AI.

Rules:
- Tone: ${toneDesc}
- Keep it 2-4 sentences. Never be verbose.
- NEVER use phrases like "I'm sorry to hear" or "Thank you for your valuable feedback" - these scream AI.
- Use natural language with slight imperfections (contractions, occasional informal phrasing).
- Address specific points from the review when possible.
- For negative reviews: acknowledge the issue, take responsibility, offer to make it right.
- For positive reviews: be genuinely grateful, mention something specific they liked.
- If the reviewer name is available, use their first name naturally (not in every sentence).
- Do NOT use emojis unless the tone is "friendly" or "witty" (max 1 emoji).
- Do NOT include a sign-off like "Best regards" or "Sincerely" - just end naturally.
- Vary sentence structure. Don't start every sentence the same way.`

        const reviewText = review.text || '(no text, just a rating)'
        const reviewerName = review.reviewerName || 'the customer'

        const userPrompt = `Review from ${reviewerName} (${review.rating}/5 stars):
"${reviewText}"

Write a response:`

        const completion = await openrouter.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 250,
          temperature: 0.85,
        })

        const aiText = completion.choices[0]?.message?.content?.trim()
        if (aiText) {
          const delayMinutes = calculateHumanDelay()
          // Apply subtle human variation
          const finalText = applySentenceVariation(aiText)
          return { reviewId, generatedText: finalText, suggestedDelayMinutes: delayMinutes, source: 'ai' }
        }
      } catch (err: any) {
        logger.warn(`AI generation failed, falling back to template: ${err.message}`)
      }
    }

    // Fallback to template-based generation
    const { responseText, delayMinutes } = humanize(review, tonePreset)
    return { reviewId, generatedText: responseText, suggestedDelayMinutes: delayMinutes, source: 'template' }
  }

  // ---------------------------------------------------------------------------
  // Schedule a response for posting
  // ---------------------------------------------------------------------------

  async scheduleResponse(
    reviewId: string,
    scheduledFor: Date,
    userId: string
  ) {
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Review not found',
      })
    }

    await this.requireMembership(review.workspaceId, userId)

    const id = randomUUID()

    await this.db.insert(aiResponseSchedules).values({
      id,
      reviewId,
      scheduledFor,
      status: 'pending',
      attempts: 0,
    })

    return { id, reviewId, scheduledFor, status: 'pending' }
  }

  // ---------------------------------------------------------------------------
  // Cancel a pending schedule
  // ---------------------------------------------------------------------------

  async cancelSchedule(scheduleId: string, userId: string) {
    const schedule = await this.db.query.aiResponseSchedules.findFirst({
      where: eq(aiResponseSchedules.id, scheduleId),
    })

    if (!schedule) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Schedule not found',
      })
    }

    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, schedule.reviewId),
    })

    if (!review) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Associated review not found',
      })
    }

    await this.requireMembership(review.workspaceId, userId)

    if (schedule.status !== 'pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only pending schedules can be cancelled',
      })
    }

    await this.db
      .update(aiResponseSchedules)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(aiResponseSchedules.id, scheduleId))

    return { id: scheduleId, status: 'cancelled' }
  }

  // ---------------------------------------------------------------------------
  // Process scheduled responses (called by cron / worker)
  // ---------------------------------------------------------------------------

  async processScheduledResponses() {
    const now = new Date()

    const dueSchedules = await this.db
      .select()
      .from(aiResponseSchedules)
      .where(
        and(
          eq(aiResponseSchedules.status, 'pending'),
          lte(aiResponseSchedules.scheduledFor, now)
        )
      )
      .limit(50)

    const results: { id: string; status: string }[] = []

    for (const schedule of dueSchedules) {
      try {
        // Mark as processing
        await this.db
          .update(aiResponseSchedules)
          .set({
            status: 'processing',
            attempts: schedule.attempts + 1,
            updatedAt: new Date(),
          })
          .where(eq(aiResponseSchedules.id, schedule.id))

        // TODO: Actually post the response via platform adapter
        // For now, just mark as completed
        await this.db
          .update(aiResponseSchedules)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(aiResponseSchedules.id, schedule.id))

        // Increment daily count
        const review = await this.db.query.reviews.findFirst({
          where: eq(reviews.id, schedule.reviewId),
        })

        if (review) {
          const today = new Date().toISOString().split('T')[0]
          await this.db
            .insert(aiResponseDailyCounts)
            .values({
              id: randomUUID(),
              locationId: review.locationId,
              date: today,
              count: 1,
            })
            .onConflictDoUpdate({
              target: [aiResponseDailyCounts.locationId, aiResponseDailyCounts.date],
              set: {
                count: sql`${aiResponseDailyCounts.count} + 1`,
              },
            })
        }

        results.push({ id: schedule.id, status: 'completed' })
      } catch (err: any) {
        await this.db
          .update(aiResponseSchedules)
          .set({
            status: 'failed',
            errorMessage: err?.message ?? 'Unknown error',
            updatedAt: new Date(),
          })
          .where(eq(aiResponseSchedules.id, schedule.id))

        results.push({ id: schedule.id, status: 'failed' })
      }
    }

    return { processed: results.length, results }
  }

  // ---------------------------------------------------------------------------
  // Get daily response counts
  // ---------------------------------------------------------------------------

  async getDailyCounts(
    locationId: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ) {
    const rows = await this.db
      .select()
      .from(aiResponseDailyCounts)
      .where(
        and(
          eq(aiResponseDailyCounts.locationId, locationId),
          gte(aiResponseDailyCounts.date, startDate.toISOString().split('T')[0]),
          lte(aiResponseDailyCounts.date, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(aiResponseDailyCounts.date)

    return rows
  }

  // ---------------------------------------------------------------------------
  // Get total AI response count for a workspace (dashboard widget)
  // ---------------------------------------------------------------------------

  async getAiResponseCount(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiResponseSchedules)
      .innerJoin(reviews, eq(aiResponseSchedules.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.workspaceId, workspaceId),
          eq(aiResponseSchedules.status, 'completed')
        )
      )

    return { count: result[0]?.count ?? 0 }
  }

  // ---------------------------------------------------------------------------
  // AI Response Settings: Get
  // ---------------------------------------------------------------------------

  async getSettings(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })

    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Workspace not found',
      })
    }

    // Read settings from workspace metadata or use defaults
    const meta = (workspace as any).metadata ?? (workspace as any).aiResponseSettings ?? {}

    return {
      tonePreset: (workspace as any).tonePreset ?? meta.tonePreset ?? 'professional',
      autoResponse: meta.autoResponse ?? false,
      dailyLimit: meta.dailyLimit ?? 10,
      minDelayDays: meta.minDelayDays ?? 1,
      maxDelayDays: meta.maxDelayDays ?? 7,
    }
  }

  // ---------------------------------------------------------------------------
  // AI Response Settings: Update
  // ---------------------------------------------------------------------------

  async updateSettings(
    workspaceId: string,
    userId: string,
    settings: {
      tonePreset?: string
      autoResponse?: boolean
      dailyLimit?: number
      minDelayDays?: number
      maxDelayDays?: number
    }
  ) {
    await this.requireMembership(workspaceId, userId)

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })

    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Workspace not found',
      })
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    }

    // If the workspace table has a tonePreset column, update it directly
    if (settings.tonePreset) {
      updatePayload.tonePreset = settings.tonePreset
    }

    // Store extended settings in metadata
    const existingMeta = (workspace as any).metadata ?? {}
    const newMeta = {
      ...existingMeta,
      autoResponse: settings.autoResponse ?? existingMeta.autoResponse,
      dailyLimit: settings.dailyLimit ?? existingMeta.dailyLimit,
      minDelayDays: settings.minDelayDays ?? existingMeta.minDelayDays,
      maxDelayDays: settings.maxDelayDays ?? existingMeta.maxDelayDays,
      tonePreset: settings.tonePreset ?? existingMeta.tonePreset,
    }

    try {
      await this.db
        .update(workspaces)
        .set({
          ...updatePayload,
          ...(Object.keys(workspaces).includes('metadata') ? { metadata: newMeta } : {}),
        } as any)
        .where(eq(workspaces.id, workspaceId))
    } catch {
      // If metadata column doesn't exist, just update tonePreset
      await this.db
        .update(workspaces)
        .set(updatePayload as any)
        .where(eq(workspaces.id, workspaceId))
    }

    return {
      tonePreset: settings.tonePreset ?? (workspace as any).tonePreset ?? 'professional',
      autoResponse: settings.autoResponse ?? existingMeta.autoResponse ?? false,
      dailyLimit: settings.dailyLimit ?? existingMeta.dailyLimit ?? 10,
      minDelayDays: settings.minDelayDays ?? existingMeta.minDelayDays ?? 1,
      maxDelayDays: settings.maxDelayDays ?? existingMeta.maxDelayDays ?? 7,
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getWorkspaceTonePreset(workspaceId: string): Promise<TonePresetKey> {
    try {
      const workspace = await this.db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      })
      const tone = (workspace as any)?.tonePreset ?? 'professional'
      return (TONE_PRESETS[tone as TonePresetKey] ? tone : 'professional') as TonePresetKey
    } catch {
      return 'professional'
    }
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt)
      ),
    })

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return membership
  }
}
