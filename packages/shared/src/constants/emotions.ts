export interface EmotionDefinition {
  name: string
  cluster: 'joy' | 'comfort' | 'frustration' | 'anxiety'
  polarity: 'positive' | 'negative'
  emoji: string
  description: string
  sortOrder: number
}

export const DEFAULT_EMOTIONS: EmotionDefinition[] = [
  // Joy Cluster (Positive)
  {
    name: 'Delight',
    cluster: 'joy',
    polarity: 'positive',
    emoji: '\u{1F929}',
    description: 'A feeling of great pleasure and satisfaction that exceeds expectations',
    sortOrder: 1,
  },
  {
    name: 'Gratitude',
    cluster: 'joy',
    polarity: 'positive',
    emoji: '\u{1F64F}',
    description: 'Thankfulness and appreciation for the experience or service received',
    sortOrder: 2,
  },
  {
    name: 'Trust',
    cluster: 'joy',
    polarity: 'positive',
    emoji: '\u{1F91D}',
    description: 'Confidence in the reliability and integrity of the business',
    sortOrder: 3,
  },
  {
    name: 'Excitement',
    cluster: 'joy',
    polarity: 'positive',
    emoji: '\u{1F389}',
    description: 'Eager enthusiasm and anticipation about the experience',
    sortOrder: 4,
  },
  {
    name: 'Pride',
    cluster: 'joy',
    polarity: 'positive',
    emoji: '\u{1F4AA}',
    description: 'A sense of accomplishment or status from choosing the brand',
    sortOrder: 5,
  },

  // Comfort Cluster (Positive)
  {
    name: 'Relief',
    cluster: 'comfort',
    polarity: 'positive',
    emoji: '\u{1F60C}',
    description: 'A feeling of reassurance after a problem is resolved or concern addressed',
    sortOrder: 6,
  },
  {
    name: 'Contentment',
    cluster: 'comfort',
    polarity: 'positive',
    emoji: '\u{263A}\u{FE0F}',
    description: 'Quiet satisfaction with the overall experience, meeting expectations',
    sortOrder: 7,
  },
  {
    name: 'Safety',
    cluster: 'comfort',
    polarity: 'positive',
    emoji: '\u{1F6E1}\u{FE0F}',
    description: 'Feeling secure and protected in the interaction with the business',
    sortOrder: 8,
  },
  {
    name: 'Belonging',
    cluster: 'comfort',
    polarity: 'positive',
    emoji: '\u{1F3E0}',
    description: 'A sense of being valued and part of the brand community',
    sortOrder: 9,
  },
  {
    name: 'Calm',
    cluster: 'comfort',
    polarity: 'positive',
    emoji: '\u{1F9D8}',
    description: 'Feeling at ease and stress-free throughout the experience',
    sortOrder: 10,
  },

  // Frustration Cluster (Negative)
  {
    name: 'Anger',
    cluster: 'frustration',
    polarity: 'negative',
    emoji: '\u{1F621}',
    description: 'Strong displeasure from feeling wronged or treated unfairly',
    sortOrder: 11,
  },
  {
    name: 'Irritation',
    cluster: 'frustration',
    polarity: 'negative',
    emoji: '\u{1F612}',
    description: 'Mild annoyance caused by small inconveniences or delays',
    sortOrder: 12,
  },
  {
    name: 'Impatience',
    cluster: 'frustration',
    polarity: 'negative',
    emoji: '\u{23F3}',
    description: 'Restlessness from waiting too long or slow processes',
    sortOrder: 13,
  },
  {
    name: 'Disappointment',
    cluster: 'frustration',
    polarity: 'negative',
    emoji: '\u{1F61E}',
    description: 'Sadness from unmet expectations or broken promises',
    sortOrder: 14,
  },
  {
    name: 'Helplessness',
    cluster: 'frustration',
    polarity: 'negative',
    emoji: '\u{1F625}',
    description: 'Feeling powerless to resolve an issue or get proper support',
    sortOrder: 15,
  },

  // Anxiety Cluster (Negative)
  {
    name: 'Worry',
    cluster: 'anxiety',
    polarity: 'negative',
    emoji: '\u{1F61F}',
    description: 'Concern about potential future problems with the product or service',
    sortOrder: 16,
  },
  {
    name: 'Confusion',
    cluster: 'anxiety',
    polarity: 'negative',
    emoji: '\u{1F615}',
    description: 'Difficulty understanding processes, communications, or expectations',
    sortOrder: 17,
  },
  {
    name: 'Fear',
    cluster: 'anxiety',
    polarity: 'negative',
    emoji: '\u{1F628}',
    description: 'Apprehension about negative outcomes or loss',
    sortOrder: 18,
  },
  {
    name: 'Overwhelm',
    cluster: 'anxiety',
    polarity: 'negative',
    emoji: '\u{1F635}',
    description: 'Feeling burdened by too many choices, steps, or complexity',
    sortOrder: 19,
  },
  {
    name: 'Distrust',
    cluster: 'anxiety',
    polarity: 'negative',
    emoji: '\u{1F928}',
    description: 'Suspicion or lack of confidence in the business intentions or quality',
    sortOrder: 20,
  },
]

export const EMOTION_CLUSTERS = ['joy', 'comfort', 'frustration', 'anxiety'] as const
export type EmotionCluster = (typeof EMOTION_CLUSTERS)[number]

export const EMOTION_POLARITIES = ['positive', 'negative'] as const
export type EmotionPolarity = (typeof EMOTION_POLARITIES)[number]
