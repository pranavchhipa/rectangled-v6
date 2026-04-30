import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TRPCError } from '@trpc/server'

/**
 * Tone presets describe the *voice*, not the structure. The structure is
 * always: short, specific, human, no AI tells.
 */
const TONE_DESCRIPTIONS: Record<string, string> = {
  professional:
    'polite and grounded — like a small-business owner who cares about doing right by customers, not corporate PR',
  friendly:
    'warm and casual — like texting a friend who came by your shop. Light, easy, never gushy',
  empathetic:
    'genuinely caring — own the screw-up plainly, no defensiveness, real ownership',
  witty:
    'a touch playful — light humour where it fits, never forced. Still respectful',
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
    location: LocationForAI,
  ): Promise<AIResponseResult> {
    if (!this.apiKey) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'AI review responses are not configured. Set OPENROUTER_API_KEY in environment.',
      })
    }

    const tonePreset = workspace.tonePreset ?? 'friendly'
    const toneDesc =
      TONE_DESCRIPTIONS[tonePreset] ?? TONE_DESCRIPTIONS.friendly
    const firstName = (review.reviewerName ?? '').trim().split(/\s+/)[0] || ''

    const sentiment =
      review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'mixed'

    const systemPrompt = `You're the owner of ${workspace.name}${
      location.name && location.name !== workspace.name ? ` (${location.name}${location.city ? `, ${location.city}` : ''})` : ''
    }${workspace.industry ? `, a ${workspace.industry} business` : ''}, replying personally to a customer review on ${review.platform === 'google' ? 'Google' : review.platform}.

VOICE: ${tonePreset} — ${toneDesc}.

THIS IS THE MOST IMPORTANT INSTRUCTION: do NOT sound like AI. Real owners write replies that are short, specific, slightly imperfect, and human. They don't use marketing speak. They mention concrete things from the review. They use contractions. They sometimes start with "And" or "But" or just a name. They write like a person, not a press release.

ABSOLUTELY DO NOT use any of these AI tells (this is the biggest giveaway):
✗ "valued customer", "valued feedback", "valued patronage"
✗ "we appreciate your feedback", "thank you for taking the time to"
✗ "your satisfaction is our top priority"
✗ "we strive to", "we endeavour to", "our team is dedicated to"
✗ "rest assured", "please know that", "kindly note"
✗ "warm regards", "best regards", "with appreciation", any formal sign-off
✗ "Dear ${firstName || 'customer'}", "Hi there", "Greetings"
✗ em-dashes ( — ), they scream AI. Use commas or full stops instead.
✗ tripled lists like "warm, welcoming, and personalised"
✗ exclamation marks at the end of every sentence
✗ "I'm sorry to hear that you experienced..." — too templated
✗ "We're glad you enjoyed..." — too templated

WRITE LIKE THIS INSTEAD:
- 2 to 4 short sentences. Sometimes a 5-word sentence is fine. Asymmetric is good.
- Use contractions: we're, you're, don't, can't, won't, that's.
- Reference one specific thing they mentioned in the review (food item, staff member, wait time, whatever they said).
- ${sentiment === 'positive' ? "Sound genuinely pleased without being over-the-top. Don't gush." : sentiment === 'negative' ? "Own it plainly. Don't be defensive. Offer to make it right with a concrete next step (call back, email, comp). Use 'I' not just 'we' — it's more personal." : "Acknowledge the mixed feedback honestly. Address what they raised."}
- ${firstName ? `Use the name "${firstName}" at most once, and only if it feels natural — most replies don't even need it.` : 'No name available, so just dive into the reply.'}
- No greeting word at the start. No sign-off at the end. Just the body of the reply.
- Match the language of the review. If they wrote in Hindi or Hinglish, reply in the same.
- Keep it to about 30-60 words.
- Maximum one emoji, only if the tone is friendly or witty AND it actually fits. Most replies should have zero emojis.

Here are a few examples of the kind of replies a real owner writes:

Example 1 (4-star, mentions food):
"Glad the biryani lived up to the hype, ${firstName ? firstName + '. ' : ''}Thanks for coming by. We're working on the wait-time thing, fair point."

Example 2 (1-star, missed delivery):
"This shouldn't have happened${firstName ? ', ' + firstName : ''}. I'm sorry. Drop me your order ID at hello@${workspace.name.toLowerCase().replace(/\s+/g, '')}.com and I'll sort the refund myself today."

Example 3 (5-star, no specifics):
"Means a lot${firstName ? ', ' + firstName : ''}. See you next time."

Example 4 (3-star, mixed):
"Honest feedback, appreciated. The slow service that night was on us — short-staffed, no excuse. Hope you'll give us another shot."

Now write a reply in that style. Just the reply, no quotes, no preamble.`

    const reviewText = review.text ?? '(no comment, just the rating)'
    const userPrompt = `Review from ${review.reviewerName ?? 'a customer'} (${review.rating} star${review.rating !== 1 ? 's' : ''}):

"${reviewText}"`

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
            max_tokens: 250,
            temperature: 0.95,
            top_p: 0.92,
            frequency_penalty: 0.6,
            presence_penalty: 0.4,
          }),
        },
      )

      if (!res.ok) {
        const err = await res.text()
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `AI API error: ${res.status} ${err}`,
        })
      }

      const data = (await res.json()) as any
      const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
      const tokensUsed = data.usage?.total_tokens

      if (!raw) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI returned an empty response',
        })
      }

      const content = humanise(raw)

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

/**
 * Post-process the model output to strip the most common AI tells that
 * sneak through despite the prompt. Last line of defence.
 */
function humanise(input: string): string {
  let s = input.trim()

  // Strip wrapping quotes if the model added them.
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }

  // Remove "Reply:" / "Response:" prefixes the model sometimes adds.
  s = s.replace(/^(Reply|Response|Owner['']?s reply)\s*[:\-—]\s*/i, '')

  // Em-dashes and en-dashes → comma or period (em-dashes are an AI tell).
  // Double-space-em-space pattern usually means a clause break: replace with ", "
  s = s.replace(/\s*[—–]\s*/g, ', ')

  // Strip banned opener phrases (case-insensitive, only at start).
  const bannedOpeners: RegExp[] = [
    /^thank you for taking the time to[^.,]*[.,]?\s*/i,
    /^thank you for your (review|feedback|kind words)[^.,]*[.,]?\s*/i,
    /^we (truly )?appreciate your (review|feedback|kind words|business|patronage|time)[^.,]*[.,]?\s*/i,
    /^we['']?re (so )?(thrilled|delighted|pleased|glad) (to hear|that you)[^.,]*[.,]?\s*/i,
    /^dear (valued )?(customer|guest|patron|sir|madam|friend)[,.\s]*/i,
    /^(hi|hello|hey|greetings)( there)?[!,]?\s*/i,
  ]
  for (const re of bannedOpeners) {
    const before = s
    s = s.replace(re, '')
    if (s !== before) s = s.charAt(0).toUpperCase() + s.slice(1)
  }

  // Strip banned phrases anywhere.
  const bannedPhrases: Array<[RegExp, string]> = [
    [/\bvalued (customer|patronage|feedback|guest)s?\b/gi, 'you'],
    [/\byour satisfaction is our (top |#1 |number one )?priority\b/gi, ''],
    [/\bwe strive to (provide|deliver|offer)\b/gi, "we try to"],
    [/\bwe endeavou?r to\b/gi, "we try to"],
    [/\bour team is dedicated to\b/gi, "we work to"],
    [/\brest assured,?\s*/gi, ''],
    [/\bplease know that\b/gi, ''],
    [/\bkindly note that\b/gi, ''],
    [/\bin closing,?\s*/gi, ''],
    [/\bwarm regards,?\s*$/gi, ''],
    [/\bbest regards,?\s*$/gi, ''],
    [/\bwith appreciation,?\s*$/gi, ''],
    [/\b(the )?(team )?at \w+\s*$/gi, ''],
  ]
  for (const [re, repl] of bannedPhrases) {
    s = s.replace(re, repl)
  }

  // Force common contractions where they were expanded.
  const contractions: Array<[RegExp, string]> = [
    [/\bwe are\b/g, "we're"],
    [/\bwe will\b/g, "we'll"],
    [/\bwe have\b/g, "we've"],
    [/\bdo not\b/g, "don't"],
    [/\bdid not\b/g, "didn't"],
    [/\bcannot\b/g, "can't"],
    [/\bwill not\b/g, "won't"],
    [/\bit is\b/g, "it's"],
    [/\bthat is\b/g, "that's"],
    [/\byou are\b/g, "you're"],
    [/\byou have\b/g, "you've"],
    [/\bI am\b/g, "I'm"],
    [/\bI have\b/g, "I've"],
    [/\bI will\b/g, "I'll"],
    [/\bI would\b/g, "I'd"],
  ]
  for (const [re, repl] of contractions) {
    s = s.replace(re, repl)
  }

  // Collapse repeated whitespace and clean up double punctuation from substitutions.
  s = s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?])\1+/g, '$1')
    .replace(/^[,.\s]+/, '')
    .trim()

  return s
}
