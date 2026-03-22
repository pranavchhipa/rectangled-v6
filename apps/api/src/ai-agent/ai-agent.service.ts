import { Injectable, Inject, Logger } from '@nestjs/common'
import { eq, desc, sql, and, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  reviews,
  customers,
  locations,
  couponTemplates,
  escalations,
  members,
} from '@rectangled/db'
import OpenAI from 'openai'

export interface AiAgentResponse {
  type: 'chat' | 'ticket'
  message: string
  subject?: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  role: 'assistant'
}

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name)
  private openai: OpenAI | null = null

  constructor(@Inject('DATABASE') private readonly db: Database) {}

  private getOpenAi(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL:
          process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'OptimizerV6 - Rectangled.io',
        },
      })
    }
    return this.openai
  }

  async chat(
    input: {
      workspaceId: string
      message: string
      history?: Array<{ role: string; content: string }>
    },
    userId: string,
  ): Promise<AiAgentResponse> {
    // Verify membership
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, input.workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt),
      ),
    })
    if (!membership) throw new Error('Not a member of this workspace')

    // Gather workspace context in parallel
    const [
      recentReviews,
      locationList,
      customerCount,
      activeCoupons,
      openEscalations,
    ] = await Promise.all([
      this.db
        .select({
          reviewerName: reviews.reviewerName,
          rating: reviews.rating,
          text: reviews.text,
          platform: reviews.platform,
          reviewedAt: reviews.reviewedAt,
        })
        .from(reviews)
        .where(eq(reviews.workspaceId, input.workspaceId))
        .orderBy(desc(reviews.reviewedAt))
        .limit(15),
      this.db
        .select({ name: locations.name, city: locations.city })
        .from(locations)
        .where(eq(locations.workspaceId, input.workspaceId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(eq(customers.workspaceId, input.workspaceId)),
      this.db
        .select({
          name: couponTemplates.name,
          discountType: couponTemplates.discountType,
          discountValue: couponTemplates.discountValue,
        })
        .from(couponTemplates)
        .where(
          and(
            eq(couponTemplates.workspaceId, input.workspaceId),
            eq(couponTemplates.isActive, true),
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(escalations)
        .where(
          and(
            eq(escalations.workspaceId, input.workspaceId),
            sql`${escalations.status} IN ('open', 'in_progress')`,
          ),
        ),
    ])

    const avgRating =
      recentReviews.length > 0
        ? (
            recentReviews.reduce((sum, r) => sum + r.rating, 0) /
            recentReviews.length
          ).toFixed(1)
        : 'N/A'

    const contextSummary = `
WORKSPACE CONTEXT:
- Locations: ${locationList.map((l) => `${l.name} (${l.city})`).join(', ') || 'None'}
- Total customers: ${customerCount[0]?.count ?? 0}
- Open escalations: ${openEscalations[0]?.count ?? 0}
- Active coupons: ${activeCoupons.map((c) => `${c.name} (${c.discountType} ${c.discountValue})`).join(', ') || 'None'}
- Average rating (recent): ${avgRating}
- Recent reviews (last 15):
${recentReviews.map((r) => `  - ${r.reviewerName} (${r.rating}\u2605 on ${r.platform}): "${(r.text ?? '').slice(0, 100)}"`).join('\n')}
`

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: `You are the Rectangled AI Assistant. You chat like a real human \u2014 casual, warm, and to the point. Think of yourself as a friendly colleague who knows everything about the user's business reputation data.

${contextSummary}

RESPONSE RULES:
- Keep responses to 2-3 sentences MAX. Be punchy and conversational.
- NO bullet points, NO markdown formatting, NO headers. Just plain text like a real person texting.
- Use emojis sparingly but naturally (1-2 per message max).
- Use casual Indian English where appropriate (e.g., "looking solid yaar", "things are going great boss").
- Reference specific numbers from the data but weave them into conversation naturally.
- Example good response: "You're killing it! 4.2 stars avg across 33 reviews, that's solid \ud83d\udd25"
- Example bad response: "Based on your analytics data, your average rating is 4.2 stars. You have received 33 reviews in total. Here are some suggestions: ..."

TICKET/COMPLAINT DETECTION:
If the user wants to raise a ticket, report an issue, file a complaint, or needs human support, you MUST respond with ONLY a valid JSON object (no extra text before or after):
{"type": "ticket", "subject": "short subject line", "description": "detailed description of the issue", "priority": "low|medium|high", "message": "your casual human-like response acknowledging the ticket"}

Choose priority based on urgency: billing/payment issues = high, bugs/broken features = medium, general feedback/questions = low.

For ALL other normal conversations, respond with ONLY a valid JSON object (no extra text before or after):
{"type": "chat", "message": "your casual human-like response here"}

IMPORTANT: Your entire response must be ONLY the JSON object. No text before or after it.`,
      },
      ...(input.history ?? []).slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: input.message },
    ]

    const completion = await this.getOpenAi().chat.completions.create({
      model: process.env.AI_MODEL || 'openai/gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    })

    const raw =
      completion.choices[0]?.message?.content ??
      '{"type": "chat", "message": "Sorry, I could not generate a response."}'

    // Try to parse JSON response from the AI
    try {
      const parsed = JSON.parse(raw)
      if (parsed.type === 'ticket') {
        return {
          type: 'ticket',
          message: parsed.message || "Got it, I'm raising a ticket for you right away!",
          subject: parsed.subject || 'Support Request',
          description: parsed.description || parsed.message,
          priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
          role: 'assistant' as const,
        }
      }
      return {
        type: 'chat',
        message: parsed.message || raw,
        role: 'assistant' as const,
      }
    } catch {
      // If AI didn't return valid JSON, treat as plain chat message
      return {
        type: 'chat',
        message: raw,
        role: 'assistant' as const,
      }
    }
  }
}
