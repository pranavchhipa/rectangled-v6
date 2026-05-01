/**
 * Phase 3 — branch condition evaluators.
 *
 * Pure functions, easy to test. Used by the survey engine to pick the next
 * step after `branch_by_score` and `branch_by_answer` steps.
 */

import type {
  BranchByScoreStep,
  BranchByAnswerStep,
  BranchOp,
} from '../types/survey-steps'

/**
 * Evaluate a single score-condition. The 'threshold' sentinel is resolved
 * to the survey's settings.thresholds[metric] before this is called — the
 * caller substitutes a concrete number.
 */
export function evaluateScoreCondition(
  op: BranchOp,
  conditionValue: number | number[],
  score: number,
): boolean {
  switch (op) {
    case 'gte':
      return typeof conditionValue === 'number' && score >= conditionValue
    case 'lte':
      return typeof conditionValue === 'number' && score <= conditionValue
    case 'gt':
      return typeof conditionValue === 'number' && score > conditionValue
    case 'lt':
      return typeof conditionValue === 'number' && score < conditionValue
    case 'eq':
      return typeof conditionValue === 'number' && score === conditionValue
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(score)
  }
}

/**
 * Walk the score-branch list in order and return the first matching
 * nextStepId. Falls back to defaultNextStepId.
 */
export function pickNextStepIdByScore(
  step: BranchByScoreStep,
  score: number,
  resolveThreshold: () => number | null,
): string {
  for (const b of step.config.branches) {
    let value = b.condition.value
    if (value === 'threshold') {
      const t = resolveThreshold()
      if (t === null) continue
      value = t
    }
    if (
      typeof value === 'number' ||
      Array.isArray(value)
    ) {
      if (evaluateScoreCondition(b.condition.op, value, score)) {
        return b.nextStepId
      }
    }
  }
  return step.config.defaultNextStepId
}

/**
 * Answer-branch evaluator. Op semantics:
 *   eq       — answer === value
 *   in       — answer ∈ value (value is an array)
 *   contains — answer is an array AND includes value (single string)
 */
export function evaluateAnswerCondition(
  op: 'eq' | 'in' | 'contains',
  conditionValue: string | string[],
  answer: unknown,
): boolean {
  switch (op) {
    case 'eq':
      return typeof conditionValue === 'string' && answer === conditionValue
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(String(answer))
    case 'contains':
      return (
        Array.isArray(answer) &&
        typeof conditionValue === 'string' &&
        answer.includes(conditionValue)
      )
  }
}

export function pickNextStepIdByAnswer(
  step: BranchByAnswerStep,
  answer: unknown,
): string {
  for (const b of step.config.branches) {
    if (evaluateAnswerCondition(b.condition.op, b.condition.value, answer)) {
      return b.nextStepId
    }
  }
  return step.config.defaultNextStepId
}
