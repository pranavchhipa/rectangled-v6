import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TRPCError } from '@trpc/server'

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional:
    'Formal, brand-focused, and authoritative. Use complete sentences and proper grammar.',
  friendly:
    'Warm, personal, and conversational. Use a welcoming tone, occasionally with light emojis.',
  empathetic:
    'Understanding, compassionate, and solution-oriented. Acknowledge feelings and offer help.',
  witty:
    'Clever, personality-driven, and memorable. Use humor tastefully while staying respectful.',
}

interface ReviewForAI {
  reviewerName: string | null
  rating: number
  text: string | null
  platform: string
}

interface WorkspaceForAI {
  name: string
  industry: string | null
  tonePreset: string | null
}

interface LocationForAI {
  name: string
  city: string | null
}

export interface AIResponseResult {
  content: string
  model: string
  tokensUsed?: number
}

@Injectable()
export class AIResponseService {
  private apiKey: string
  private defaultModel: string

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENROUTER_API_KEY') ?? ''
    this.defaultModel =
      this.config.get<string>('OPENROUTER_DEFAULT_MODEL') ??
      'anthropic/claude-3.5-sonnet'
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async generateResponse(
    review: ReviewForAI,
    workspace: WorkspaceForAI,
    location: LocationForAI
  ): Promise<AIResponseResult> {
    if (!this.apiKey) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'AI review responses are not configured. Set OPENROUTER_API_KEY in environment.',
      })
    }

    const tonePreset = workspace.tonePreset ?? 'professional'
    const toneDesc =
      TONE_DESCRIPTIONS[tonePreset] ?? TONE_DESCRIPTIONS.professional

    const systemPrompt = `You are a business owner responding to a customer review on ${review.platform === 'google' ? 'Google' : review.platform}.

Business: ${workspace.name}${workspace.industry ? ` (${workspace.industry})` : ''}
Location: ${location.name}${location.city ? `, ${location.city}` : ''}
Tone: ${tonePreset} — ${toneDesc}

Rules:
- Write 2-4 sentences. Be natural and human-like.
- Address the reviewer by first name if available.
- Acknowledge specific points from the review.
- For negative reviews (1-2 stars): be empathetic, apologize sincerely, offer to make it right.
- For neutral reviews (3 stars): thank them, address any concerns, invite them back.
- For positive reviews (4-5 stars): express genuine gratitude, highlight what they enjoyed.
- Never sound robotic, templated, or generic.
- Do not use phrases like "Dear valued customer" or "We appreciate your feedback".
- Match the language of the review if it is not in English.
- Do not include any greeting like "Hi" or "Hello" — start directly with the response content.`

    const reviewText = review.text ?? '(No text provided)'
    const userPrompt = `Review from ${review.reviewerName ?? 'Anonymous'} — ${review.rating} star${review.rating !== 1 ? 's' : ''}:

"${reviewText}"

Write a response:`

    try {
      const res = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://rectangled.io',
            'X-Title': 'rectangled.io',
          },
          body: JSON.stringify({
            model: this.defaultModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.text()
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `AI API error: ${res.status} ${err}`,
        })
      }

      const data = (await res.json()) as any
      const content =
        data.choices?.[0]?.message?.content?.trim() ?? ''
      const tokensUsed = data.usage?.total_tokens

      if (!content) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI returned an empty response',
        })
      }

      return {
        content,
        model: this.defaultModel,
        tokensUsed,
      }
    } catch (err: any) {
      if (err instanceof TRPCError) throw err
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to generate AI response: ${err.message}`,
      })
    }
  }
}
