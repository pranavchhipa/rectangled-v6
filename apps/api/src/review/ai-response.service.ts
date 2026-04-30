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

    const businessContext = inferBusinessContext(workspace, location)

    const systemPrompt = `You're the owner of ${workspace.name}${
      location.name && location.name !== workspace.name ? ` (${location.name}${location.city ? `, ${location.city}` : ''})` : ''
    }${workspace.industry ? `, a ${workspace.industry}` : ''}, replying personally to a customer review on ${review.platform === 'google' ? 'Google' : review.platform}.

BUSINESS CONTEXT (CRITICAL — your reply must feel like it's about THIS specific business, not a generic shop):
${businessContext.summary}
Words to consider using when natural: ${businessContext.keywords.join(', ')}.
What you do for customers: ${businessContext.serves}.

VOICE: ${tonePreset} — ${toneDesc}.

THIS IS THE MOST IMPORTANT INSTRUCTION: do NOT sound like AI. Real owners write replies that are short, specific, slightly imperfect, and human. They mention concrete things related to THEIR business. They use contractions. They sometimes start with "And" or "But" or just a name. They write like a person, not a press release.

EVERY REPLY MUST PASS THIS TEST: someone reading the reply alone (without seeing the original review) should be able to guess what kind of business this is. If your reply could've been written by ANY business, you've failed. Reference what you actually do — the pups, the food, the haircut, the rooms, whatever fits.

ABSOLUTELY DO NOT use any of these AI tells (this is the biggest giveaway):
✗ "valued customer", "valued feedback", "valued patronage"
✗ "we appreciate your feedback", "thank you for taking the time to"
✗ "your satisfaction is our top priority"
✗ "we strive ..." in any form (we strive to, we strive for, we strive in, we strive at). Just don't use "strive".
✗ "we endeavour to", "our team is dedicated to", "we're committed to"
✗ "in everything we do", "in all that we do", "every time"
✗ "rest assured", "please know that", "kindly note"
✗ "truly", "genuinely" as fillers — they sound AI ("truly appreciated", "genuinely thrilled")
✗ "warm regards", "best regards", "with appreciation", any formal sign-off
✗ "Hope to see you again soon!" / "Looking forward to serving you" — generic closers
✗ "Dear ${firstName || 'customer'}", "Hi there", "Greetings"
✗ em-dashes ( — ), they scream AI. Use commas or full stops instead.
✗ tripled lists like "warm, welcoming, and personalised"
✗ exclamation marks at the end of every sentence
✗ "I'm sorry to hear that you experienced..." — too templated

WRITE LIKE THIS INSTEAD:
- 2 to 4 short sentences. Sometimes a 5-word sentence is fine. Asymmetric is good.
- Use contractions: we're, you're, don't, can't, won't, that's.
- ${review.text && review.text.length > 20
        ? `The review text is "${(review.text || '').slice(0, 200)}". Pull ONE specific word/thing from it and reflect it back. If they said "biryani" mention biryani, if they said "Rohan" mention Rohan, if they said "wait time" address wait time.`
        : `The review has little or no text — so YOU bring the specifics from the business. Mention something concrete that ${workspace.name} actually does (e.g. ${businessContext.exampleMentions}).`}
- ${sentiment === 'positive' ? "Sound genuinely pleased without being over-the-top. Don't gush." : sentiment === 'negative' ? "Own it plainly. Don't be defensive. Offer to make it right with a concrete next step (call back, email, comp). Use 'I' not just 'we' — it's more personal." : "Acknowledge the mixed feedback honestly. Address what they raised."}
- ${firstName ? `Use the name "${firstName}" at most once, and only if it feels natural — most replies don't even need it.` : 'No name available, so just dive into the reply.'}
- No greeting word at the start. No sign-off at the end. Just the body of the reply.
- Match the language of the review. If they wrote in Hindi or Hinglish, reply in the same.
- Keep it to about 25-55 words.
- Maximum one emoji, only if the tone is friendly or witty AND it actually fits. Most replies should have zero emojis.

Here are examples of the kind of replies a real owner writes:

Example 1 (restaurant, 4-star, mentions food):
"Glad the biryani lived up to the hype${firstName ? ', ' + firstName : ''}. Thanks for coming by. We're working on the wait-time thing, fair point."

Example 2 (dog daycare/shelter, 5-star, generic praise):
"Means a lot${firstName ? ', ' + firstName : ''}. The pups will be happy you're back soon. Thanks for trusting us with your boy."

Example 3 (any business, 1-star):
"This shouldn't have happened${firstName ? ', ' + firstName : ''}. I'm sorry. Drop me your details at hello@${workspace.name.toLowerCase().replace(/\s+/g, '')}.com and I'll sort it myself today."

Example 4 (salon, 5-star, no specifics):
"Thanks${firstName ? ', ' + firstName : ''}. Tell Priya hi from us next visit, she'll be glad you liked the cut."

Example 5 (3-star, mixed):
"Honest feedback, appreciated. The slow service that night was on us, short-staffed and no excuse. Hope you'll give us another shot."

Now write a reply in that style for the review below. Just the reply, no quotes, no preamble. It MUST mention something specific to ${workspace.name}'s business — not generic phrases about "everything we do".`

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
 * Infer business-specific context from workspace name + industry so the
 * model can reference what the business actually does, not generic
 * "everything we do" phrases.
 */
function inferBusinessContext(
  workspace: WorkspaceForAI,
  location: LocationForAI,
): { summary: string; keywords: string[]; serves: string; exampleMentions: string } {
  const haystack = [workspace.name, workspace.industry, location.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const matchers: Array<{
    test: RegExp
    summary: string
    keywords: string[]
    serves: string
    examples: string
  }> = [
    {
      test: /\b(woof|paw|pup|dog|kennel|shelter|pet|cat|vet|kibble|boarding|daycare|grooming)\b/,
      summary: `${workspace.name} is a pet/dog business — likely boarding, daycare, grooming, or a shelter.`,
      keywords: ['pups', 'dogs', 'boy', 'girl', 'tail', 'walks', 'boarding', 'shelter', 'safe space', 'lawn', 'play time'],
      serves: 'looking after pets while owners are away, or as a permanent home',
      examples: 'the pups, the lawn, the play time, our boarders, the safe space they get here',
    },
    {
      test: /\b(restaurant|kitchen|cafe|bistro|biryani|pizza|burger|food|dining|chef|menu|tandoor|dosa|tiffin)\b/,
      summary: `${workspace.name} is a food / restaurant business.`,
      keywords: ['kitchen', 'menu', 'chef', 'dish', 'meal', 'crowd', 'service', 'wait time'],
      serves: 'feeding people good food',
      examples: 'a specific dish from the menu, the kitchen team, your next meal here',
    },
    {
      test: /\b(salon|hair|stylist|barber|nails|spa|beauty|makeup|threading|waxing)\b/,
      summary: `${workspace.name} is a salon / beauty / personal care business.`,
      keywords: ['stylist', 'cut', 'colour', 'service', 'chair', 'next visit', 'team'],
      serves: 'making customers feel good about how they look',
      examples: 'the stylist, the cut, the products used',
    },
    {
      test: /\b(hotel|stay|inn|resort|villa|rooms?|booking|guest)\b/,
      summary: `${workspace.name} is a hotel / hospitality business.`,
      keywords: ['rooms', 'stay', 'team', 'breakfast', 'check-in', 'next visit', 'view'],
      serves: 'hosting guests overnight',
      examples: 'their room, the check-in team, breakfast, the view',
    },
    {
      test: /\b(clinic|doctor|dental|dentist|hospital|pharma|chemist)\b/,
      summary: `${workspace.name} is a clinic / healthcare practice.`,
      keywords: ['team', 'appointment', 'visit', 'care', 'follow-up'],
      serves: 'caring for patients',
      examples: 'the team that saw them, their follow-up, their treatment',
    },
    {
      test: /\b(gym|fitness|yoga|trainer|workout|crossfit)\b/,
      summary: `${workspace.name} is a gym / fitness business.`,
      keywords: ['trainer', 'workout', 'class', 'session', 'progress'],
      serves: 'helping people get fitter',
      examples: 'their trainer, the class they attend, their progress',
    },
    {
      test: /\b(school|academy|tuition|coaching|class|institute|learning)\b/,
      summary: `${workspace.name} is an education / coaching business.`,
      keywords: ['students', 'class', 'teacher', 'session', 'progress'],
      serves: 'teaching students',
      examples: 'the teacher, the class, their progress',
    },
    {
      test: /\b(store|shop|retail|mart|boutique|bazaar|kirana)\b/,
      summary: `${workspace.name} is a retail / store business.`,
      keywords: ['the store', 'team', 'next visit', 'product'],
      serves: 'selling things to customers',
      examples: 'a specific product they bought, the staff who helped them',
    },
    {
      test: /\b(garage|service|repair|mechanic|workshop|automotive|car|bike)\b/,
      summary: `${workspace.name} is an automotive / repair / service business.`,
      keywords: ['the team', 'service', 'repair', 'workshop', 'pickup'],
      serves: 'fixing or servicing vehicles',
      examples: 'their service, the workshop team, the work done',
    },
  ]

  for (const m of matchers) {
    if (m.test.test(haystack)) {
      return {
        summary: m.summary,
        keywords: m.keywords,
        serves: m.serves,
        exampleMentions: m.examples,
      }
    }
  }

  // Generic fallback — still steer toward concrete language.
  return {
    summary: `${workspace.name}${workspace.industry ? `, a ${workspace.industry}` : ''}.`,
    keywords: ['the team', 'next visit', 'our work'],
    serves: workspace.industry || 'serving customers locally',
    exampleMentions: 'the team, their next visit, the specific service they used',
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
    // Catch ALL "we strive ..." patterns: strive to/for/in/at/towards anything
    [/\bwe (always )?strive (to|for|in|at|towards?) [^.,!?]+/gi, ''],
    [/\bwe['']?re (always )?striving (to|for|in|at|towards?) [^.,!?]+/gi, ''],
    [/\bwe endeavou?r to[^.,!?]+/gi, ''],
    [/\bour team is dedicated to[^.,!?]+/gi, ''],
    [/\bwe['']?re (fully |completely |totally )?committed to[^.,!?]+/gi, ''],
    [/\bin everything we do\b/gi, ''],
    [/\bin all (that )?we do\b/gi, ''],
    [/\b(every|each) (single )?time\b/gi, ''],
    [/\brest assured,?\s*/gi, ''],
    [/\bplease know that\b/gi, ''],
    [/\bkindly note that\b/gi, ''],
    [/\bin closing,?\s*/gi, ''],
    [/\btruly appreciate(d)?\b/gi, 'appreciate$1'],
    [/\bgenuinely appreciate(d)?\b/gi, 'appreciate$1'],
    [/\b(is |are )truly\b/gi, '$1really'],
    // Generic AI closers — strip when they're standalone trailing sentences.
    [/\.\s*hope to (see|serve|welcome) you (back |again )?soon[!.]?\s*$/gi, '.'],
    [/\.\s*looking forward to (seeing|serving|welcoming) you (back |again )?soon[!.]?\s*$/gi, '.'],
    [/\.\s*we hope to see you (back |again )?soon[!.]?\s*$/gi, '.'],
    // Sign-offs.
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
