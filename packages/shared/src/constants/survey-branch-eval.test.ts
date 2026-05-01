import { describe, it, expect } from 'vitest'
import {
  evaluateScoreCondition,
  evaluateAnswerCondition,
  pickNextStepIdByScore,
  pickNextStepIdByAnswer,
} from './survey-branch-eval'
import type { BranchByScoreStep, BranchByAnswerStep } from '../types/survey-steps'

describe('evaluateScoreCondition', () => {
  it('gte', () => {
    expect(evaluateScoreCondition('gte', 4, 4)).toBe(true)
    expect(evaluateScoreCondition('gte', 4, 5)).toBe(true)
    expect(evaluateScoreCondition('gte', 4, 3)).toBe(false)
  })
  it('lte', () => {
    expect(evaluateScoreCondition('lte', 6, 6)).toBe(true)
    expect(evaluateScoreCondition('lte', 6, 7)).toBe(false)
  })
  it('gt / lt strict', () => {
    expect(evaluateScoreCondition('gt', 4, 4)).toBe(false)
    expect(evaluateScoreCondition('gt', 4, 5)).toBe(true)
    expect(evaluateScoreCondition('lt', 4, 3)).toBe(true)
    expect(evaluateScoreCondition('lt', 4, 4)).toBe(false)
  })
  it('eq', () => {
    expect(evaluateScoreCondition('eq', 5, 5)).toBe(true)
    expect(evaluateScoreCondition('eq', 5, 4)).toBe(false)
  })
  it('in (array)', () => {
    expect(evaluateScoreCondition('in', [1, 2, 3], 2)).toBe(true)
    expect(evaluateScoreCondition('in', [1, 2, 3], 5)).toBe(false)
  })
})

describe('pickNextStepIdByScore', () => {
  const step: BranchByScoreStep = {
    id: 'b1',
    type: 'branch_by_score',
    config: {
      metricFromStepId: 's1',
      branches: [
        { condition: { op: 'lte', value: 6 }, nextStepId: 'detractor' },
        { condition: { op: 'gte', value: 9 }, nextStepId: 'promoter' },
      ],
      defaultNextStepId: 'passive',
    },
  }
  it('routes detractors', () => {
    expect(pickNextStepIdByScore(step, 5, () => null)).toBe('detractor')
    expect(pickNextStepIdByScore(step, 6, () => null)).toBe('detractor')
  })
  it('routes promoters', () => {
    expect(pickNextStepIdByScore(step, 9, () => null)).toBe('promoter')
    expect(pickNextStepIdByScore(step, 10, () => null)).toBe('promoter')
  })
  it('routes passives via default', () => {
    expect(pickNextStepIdByScore(step, 7, () => null)).toBe('passive')
    expect(pickNextStepIdByScore(step, 8, () => null)).toBe('passive')
  })
  it('first matching branch wins', () => {
    const overlap: BranchByScoreStep = {
      id: 'b1',
      type: 'branch_by_score',
      config: {
        metricFromStepId: 's1',
        branches: [
          { condition: { op: 'gte', value: 4 }, nextStepId: 'a' },
          { condition: { op: 'gte', value: 7 }, nextStepId: 'b' }, // shadowed
        ],
        defaultNextStepId: 'default',
      },
    }
    expect(pickNextStepIdByScore(overlap, 8, () => null)).toBe('a')
  })
})

describe('pickNextStepIdByScore — threshold sentinel', () => {
  const step: BranchByScoreStep = {
    id: 'b1',
    type: 'branch_by_score',
    config: {
      metricFromStepId: 's1',
      branches: [
        { condition: { op: 'gte', value: 'threshold' }, nextStepId: 'happy' },
      ],
      defaultNextStepId: 'unhappy',
    },
  }
  it('substitutes the threshold from the resolver', () => {
    expect(pickNextStepIdByScore(step, 5, () => 4)).toBe('happy')
    expect(pickNextStepIdByScore(step, 3, () => 4)).toBe('unhappy')
  })
  it('skips the branch when resolver returns null', () => {
    expect(pickNextStepIdByScore(step, 100, () => null)).toBe('unhappy')
  })
})

describe('evaluateAnswerCondition', () => {
  it('eq', () => {
    expect(evaluateAnswerCondition('eq', 'yes', 'yes')).toBe(true)
    expect(evaluateAnswerCondition('eq', 'yes', 'no')).toBe(false)
  })
  it('in', () => {
    expect(evaluateAnswerCondition('in', ['yes', 'maybe'], 'yes')).toBe(true)
    expect(evaluateAnswerCondition('in', ['yes', 'maybe'], 'no')).toBe(false)
  })
  it('contains (multi-select answer includes value)', () => {
    expect(evaluateAnswerCondition('contains', 'food', ['food', 'service'])).toBe(true)
    expect(evaluateAnswerCondition('contains', 'staff', ['food', 'service'])).toBe(false)
  })
})

describe('pickNextStepIdByAnswer', () => {
  const step: BranchByAnswerStep = {
    id: 'b1',
    type: 'branch_by_answer',
    config: {
      answerFromStepId: 'q1',
      branches: [
        { condition: { op: 'eq', value: 'yes' }, nextStepId: 'yes_path' },
        { condition: { op: 'contains', value: 'food' }, nextStepId: 'food_path' },
      ],
      defaultNextStepId: 'default_path',
    },
  }
  it('routes by exact match', () => {
    expect(pickNextStepIdByAnswer(step, 'yes')).toBe('yes_path')
  })
  it('routes by contains', () => {
    expect(pickNextStepIdByAnswer(step, ['food', 'staff'])).toBe('food_path')
  })
  it('falls back to default', () => {
    expect(pickNextStepIdByAnswer(step, 'nothing matches')).toBe('default_path')
  })
})
