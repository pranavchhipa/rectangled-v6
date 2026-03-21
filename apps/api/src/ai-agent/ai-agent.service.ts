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
  ) {
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
        content: `You are the Rectangled AI Assistant \u2014 a helpful chatbot for an Online Reputation Management platform used by Indian SMBs. You have access to the workspace's real-time data. Answer questions about reviews, customers, ratings, trends, coupons, and escalations. Be concise, friendly, and data-driven. Use the workspace context below to provide accurate answers.

${contextSummary}

Guidelines:
- Reference specific data when answering (e.g., "Your average rating is ${avgRating}")
- Suggest actionable improvements based on the data
- Keep responses under 200 words
- Use Indian business context (INR, Indian city names, etc.)`,
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

    return {
      message:
        completion.choices[0]?.message?.content ??
        'Sorry, I could not generate a response.',
      role: 'assistant' as const,
    }
  }
}
