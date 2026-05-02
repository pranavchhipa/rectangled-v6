/**
 * Hotfix PRD §3 — owner-facing labels for the 8 SurveyStep kinds.
 *
 * Step type names in code are developer terms (`ask_metric`,
 * `end_journey`, etc.) — fine internally, but they confuse SMB owners
 * when they leak into the editor UI. This module is the SINGLE source
 * of truth for the label / description / icon shown to owners
 * anywhere a step type appears in user-facing copy:
 *
 *   - Canvas node headers
 *   - "Add step" palette buttons
 *   - Side sheet headers / descriptions
 *   - The §3 wizard's "+ Insert step" modal
 *
 * Internal identifiers DO NOT change: `surveys.steps[].type` keeps the
 * `ask_metric` / `end_journey` / etc. wire values, validator keys stay
 * as-is, type names stay as-is. This is purely a copy layer.
 */

import type { SurveyStepType } from '../types/survey-steps'

export interface StepTypeLabel {
  /** Owner-facing name. */
  label: string
  /** One-sentence explanation for tooltips and palette descriptions. */
  description: string
  /** Emoji string (NOT a Lucide component — those stay in canvas-specific maps). */
  icon: string
}

export const STEP_TYPE_LABELS: Record<SurveyStepType, StepTypeLabel> = {
  ask_metric: {
    label: 'Rating Question',
    description: 'Ask the customer for a rating (CSAT, NPS, CES, NEV, or CLI)',
    icon: '⭐',
  },
  ask_question: {
    label: 'Open Question',
    description: 'Free-text or multi-select question',
    icon: '💬',
  },
  branch_by_score: {
    label: 'Route by Score',
    description: 'Branch the journey based on a rating score',
    icon: '🔀',
  },
  branch_by_answer: {
    label: 'Route by Answer',
    description: 'Branch based on a question answer',
    icon: '🔀',
  },
  show_message: {
    label: 'Info Screen',
    description: 'Show a message to the customer',
    icon: '✋',
  },
  collect_contact: {
    label: 'Contact Form',
    description: 'Collect name, phone, or email',
    icon: '📞',
  },
  redirect: {
    label: 'Review Redirect',
    description: 'Ask the customer to leave a review on an external platform',
    icon: '🌐',
  },
  end_journey: {
    label: 'Thank You Screen',
    description: 'Final screen with optional coupon',
    icon: '🏁',
  },
}

/**
 * Convenience lookup with a graceful fallback for unknown step types
 * (defensive — the validator should catch these but defense-in-depth
 * keeps the canvas from crashing on stale data).
 */
export function getStepTypeLabel(type: string): StepTypeLabel {
  return (
    STEP_TYPE_LABELS[type as SurveyStepType] ?? {
      label: type,
      description: '',
      icon: '•',
    }
  )
}
