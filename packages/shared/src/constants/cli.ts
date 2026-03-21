export const CLI_WEIGHTS = {
  trust: 0.35,
  satisfaction: 0.40,
  advocacy: 0.25,
} as const

export const CLI_MULTIPLIERS = {
  /** trust weight * 10 = 3.5, so trustScore (1-10) * 3.5 gives max 35 */
  trust: 3.5,
  /** satisfaction weight * 10 = 4.0, so satisfactionScore (1-10) * 4.0 gives max 40 */
  satisfaction: 4.0,
  /** advocacy weight * 10 = 2.5, so advocacyScore (0-10) * 2.5 gives max 25 */
  advocacy: 2.5,
} as const

export interface CliSegmentDefinition {
  key: string
  label: string
  min: number
  max: number
  description: string
}

export const CLI_SEGMENTS: CliSegmentDefinition[] = [
  {
    key: 'champion',
    label: 'Champions',
    min: 80,
    max: 100,
    description: 'High on all 3 pillars — your most valuable advocates',
  },
  {
    key: 'loyalist',
    label: 'Loyalists',
    min: 60,
    max: 79,
    description: 'Strong loyalty but with room to grow into champions',
  },
  {
    key: 'passive',
    label: 'Passives',
    min: 40,
    max: 59,
    description: 'Indifferent customers at risk of switching to competitors',
  },
  {
    key: 'at_risk',
    label: 'At-Risk',
    min: 20,
    max: 39,
    description: 'Declining loyalty — needs immediate attention and recovery',
  },
  {
    key: 'detractor',
    label: 'Detractors',
    min: 0,
    max: 19,
    description: 'Actively unhappy customers who may damage your reputation',
  },
]

export function determineCliSegment(score: number): string {
  if (score >= 80) return 'champion'
  if (score >= 60) return 'loyalist'
  if (score >= 40) return 'passive'
  if (score >= 20) return 'at_risk'
  return 'detractor'
}

export function calculateCliScore(
  trustScore: number,
  satisfactionScore: number,
  advocacyScore: number
): number {
  return (
    trustScore * CLI_MULTIPLIERS.trust +
    satisfactionScore * CLI_MULTIPLIERS.satisfaction +
    advocacyScore * CLI_MULTIPLIERS.advocacy
  )
}
