/**
 * Hotfix PRD §3 (PR 1) — buildCustomStepsFromWizard tests.
 *
 * Each test produces a step graph from a specific wizard answer combo
 * and asserts both:
 *   1. The generated graph passes `surveyStepsSchema` (the wire-level
 *      validator from Step A — same one survey.update.steps enforces).
 *   2. The structural rules from PRD §3.9: every step is reachable
 *      from step[0] and every path terminates in an end_journey.
 *
 * The structural assertions are inlined here as small helpers; PR 3
 * will pull them out into the dedicated §3.9 validation module.
 */

import { describe, it, expect } from 'vitest'
import {
  buildCustomStepsFromWizard,
  buildQuickIntelligentSteps,
  buildDeepIntelligentSteps,
} from './survey-step-builders'
import { surveyStepsSchema } from '../validators/survey-steps'
import type { SurveyStep } from '../types/survey-steps'
import type { WizardAnswers } from '../validators/survey-wizard'

// ─── Structural assertions (inlined; full validator in PR 3) ────────────

function stepsById(steps: SurveyStep[]): Map<string, SurveyStep> {
  const m = new Map<string, SurveyStep>()
  for (const s of steps) m.set(s.id, s)
  return m
}

function nextIdsOf(s: SurveyStep): string[] {
  switch (s.type) {
    case 'ask_metric':
    case 'ask_question':
      return s.config.onComplete.nextStepId ? [s.config.onComplete.nextStepId] : []
    case 'show_message':
    case 'collect_contact':
      return s.config.nextStepId ? [s.config.nextStepId] : []
    case 'branch_by_score':
    case 'branch_by_answer':
      return [
        ...s.config.branches.map((b) => b.nextStepId),
        s.config.defaultNextStepId,
      ]
    case 'redirect':
      return [
        ...(s.config.onYesNextStepId ? [s.config.onYesNextStepId] : []),
        ...(s.config.onNoNextStepId ? [s.config.onNoNextStepId] : []),
      ]
    case 'end_journey':
      return []
  }
}

function reachableFromStart(steps: SurveyStep[]): Set<string> {
  if (steps.length === 0) return new Set()
  const byId = stepsById(steps)
  const visited = new Set<string>()
  const stack = [steps[0]!.id]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    const s = byId.get(id)
    if (!s) continue
    for (const nxt of nextIdsOf(s)) stack.push(nxt)
  }
  return visited
}

function assertGraphIntegrity(steps: SurveyStep[]): void {
  // 1. Discriminated-union schema.
  const parsed = surveyStepsSchema.safeParse(steps)
  expect(parsed.success).toBe(true)

  // 2. All step IDs unique.
  const ids = new Set(steps.map((s) => s.id))
  expect(ids.size).toBe(steps.length)

  // 3. Every nextStepId reference exists.
  for (const s of steps) {
    for (const target of nextIdsOf(s)) {
      expect(ids.has(target)).toBe(true)
    }
  }

  // 4. Every step is reachable from step[0].
  const reachable = reachableFromStart(steps)
  for (const s of steps) {
    expect(reachable.has(s.id)).toBe(true)
  }

  // 5. Terminal-only steps are end_journey.
  for (const s of steps) {
    if (nextIdsOf(s).length === 0) {
      expect(s.type).toBe('end_journey')
    }
  }
}

// ─── Existing builders sanity-check (regression net) ────────────────────
//
// buildQuickIntelligentSteps / buildDeepIntelligentSteps must keep passing
// the new strict validator. If a future change breaks shape, we want a
// loud test failure, not a quiet runtime error in the engine.

describe('buildQuickIntelligentSteps (regression)', () => {
  it('produces a graph that passes the discriminated-union validator', () => {
    const steps = buildQuickIntelligentSteps()
    assertGraphIntegrity(steps)
  })
})

describe('buildDeepIntelligentSteps (regression)', () => {
  it('all 4 deep types produce valid graphs', () => {
    for (const type of ['csat', 'nps', 'ces', 'custom'] as const) {
      const steps = buildDeepIntelligentSteps(type)
      assertGraphIntegrity(steps)
    }
  })
})

// ─── buildCustomStepsFromWizard ─────────────────────────────────────────

const ALL_NEG_FLAGS_OFF: WizardAnswers['negativeOptions'] = {
  askAspects: false,
  askFeedback: false,
  collectContact: false,
  issueCoupon: false,
}

describe('buildCustomStepsFromWizard — Q1 metric', () => {
  it('csat produces ask_metric with metric=csat and gte branch op', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 4,
    })
    const metricStep = steps.find((s) => s.id === 's1_metric')!
    expect(metricStep.type).toBe('ask_metric')
    if (metricStep.type === 'ask_metric') {
      expect(metricStep.config.metric).toBe('csat')
    }
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.branches[0]!.condition.op).toBe('gte')
      expect(branch.config.branches[0]!.condition.value).toBe(4)
    }
    assertGraphIntegrity(steps)
  })

  it('nps produces ask_metric with metric=nps and gte branch op', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'nps',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 9,
    })
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.branches[0]!.condition.op).toBe('gte')
      expect(branch.config.branches[0]!.condition.value).toBe(9)
    }
    assertGraphIntegrity(steps)
  })

  it('ces produces lte branch op (inverted metric)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'ces',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 3,
    })
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.branches[0]!.condition.op).toBe('lte')
      expect(branch.config.branches[0]!.condition.value).toBe(3)
    }
    assertGraphIntegrity(steps)
  })

  it('throws on metric=random — caller must short-circuit to template=adaptive', () => {
    expect(() =>
      buildCustomStepsFromWizard({
        metric: 'random',
        positiveAction: 'just_thank',
        negativeOptions: ALL_NEG_FLAGS_OFF,
        threshold: 4,
      }),
    ).toThrow(/random/)
  })
})

describe('buildCustomStepsFromWizard — Q2 positive action', () => {
  it('redirect_google adds redirect step + 2 end_journey terminals (yes/no)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'redirect_google',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 4,
    })
    const positive = steps.find((s) => s.id === 's3_positive')!
    expect(positive.type).toBe('redirect')
    if (positive.type === 'redirect') {
      expect(positive.config.platform).toBe('google')
      expect(positive.config.onYesNextStepId).toBe('s_end_positive_yes')
      expect(positive.config.onNoNextStepId).toBe('s_end_positive_no')
    }
    expect(steps.find((s) => s.id === 's_end_positive_yes')?.type).toBe('end_journey')
    expect(steps.find((s) => s.id === 's_end_positive_no')?.type).toBe('end_journey')
    assertGraphIntegrity(steps)
  })

  it('redirect_zomato sets platform=zomato', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'redirect_zomato',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 4,
    })
    const positive = steps.find((s) => s.id === 's3_positive')!
    if (positive.type === 'redirect') {
      expect(positive.config.platform).toBe('zomato')
    }
    assertGraphIntegrity(steps)
  })

  it('just_thank skips redirect — branch positive points directly to single end_journey', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 4,
    })
    expect(steps.find((s) => s.id === 's3_positive')).toBeUndefined()
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.branches[0]!.nextStepId).toBe('s_end_positive_thanks')
    }
    expect(steps.find((s) => s.id === 's_end_positive_thanks')?.type).toBe('end_journey')
    assertGraphIntegrity(steps)
  })
})

describe('buildCustomStepsFromWizard — Q3 negative chain ordering', () => {
  it('all 4 negative flags ON → aspects → feedback → contact → end (with coupon)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: {
        askAspects: true,
        askFeedback: true,
        collectContact: true,
        issueCoupon: true,
      },
      threshold: 4,
      couponTemplateId: '00000000-0000-0000-0000-000000000123',
    })

    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.defaultNextStepId).toBe('s3_negative_aspects')
    }

    const aspects = steps.find((s) => s.id === 's3_negative_aspects')!
    if (aspects.type === 'ask_question') {
      expect(aspects.config.fieldType).toBe('multi_select')
      expect(aspects.config.onComplete.nextStepId).toBe('s_negative_feedback')
    }

    const feedback = steps.find((s) => s.id === 's_negative_feedback')!
    if (feedback.type === 'ask_question') {
      expect(feedback.config.fieldType).toBe('textarea')
      expect(feedback.config.onComplete.nextStepId).toBe('s4_contact')
    }

    const contact = steps.find((s) => s.id === 's4_contact')!
    if (contact.type === 'collect_contact') {
      expect(contact.config.nextStepId).toBe('s_end_negative')
    }

    const end = steps.find((s) => s.id === 's_end_negative')!
    if (end.type === 'end_journey') {
      expect(end.config.issueCoupon?.templateId).toBe('00000000-0000-0000-0000-000000000123')
      expect(end.config.triggerEvent).toBe('journey_completed_negative')
    }

    assertGraphIntegrity(steps)
  })

  it('only collect_contact → branch.default → contact → end (no aspects/feedback in graph)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: {
        askAspects: false,
        askFeedback: false,
        collectContact: true,
        issueCoupon: false,
      },
      threshold: 4,
    })
    expect(steps.find((s) => s.id === 's3_negative_aspects')).toBeUndefined()
    expect(steps.find((s) => s.id === 's_negative_feedback')).toBeUndefined()

    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.defaultNextStepId).toBe('s4_contact')
    }
    const contact = steps.find((s) => s.id === 's4_contact')!
    if (contact.type === 'collect_contact') {
      expect(contact.config.nextStepId).toBe('s_end_negative')
    }
    assertGraphIntegrity(steps)
  })

  it('only ask_aspects → branch.default → aspects → end (skips feedback + contact)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: {
        askAspects: true,
        askFeedback: false,
        collectContact: false,
        issueCoupon: false,
      },
      threshold: 4,
    })
    const aspects = steps.find((s) => s.id === 's3_negative_aspects')!
    if (aspects.type === 'ask_question') {
      expect(aspects.config.onComplete.nextStepId).toBe('s_end_negative')
    }
    assertGraphIntegrity(steps)
  })

  it('zero negative flags → branch.default points directly to end_negative', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 4,
    })
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.defaultNextStepId).toBe('s_end_negative')
    }
    expect(steps).toHaveLength(4) // metric + branch + end_positive_thanks + end_negative
    assertGraphIntegrity(steps)
  })

  it('issueCoupon=true without couponTemplateId → no coupon attached (defensive)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: {
        askAspects: false,
        askFeedback: false,
        collectContact: false,
        issueCoupon: true,
      },
      threshold: 4,
      // couponTemplateId intentionally omitted
    })
    const end = steps.find((s) => s.id === 's_end_negative')!
    if (end.type === 'end_journey') {
      expect(end.config.issueCoupon).toBeUndefined()
    }
    assertGraphIntegrity(steps)
  })
})

describe('buildCustomStepsFromWizard — Q4 threshold', () => {
  it('CSAT threshold 5 sets branch value=5', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 5,
    })
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.branches[0]!.condition.value).toBe(5)
    }
  })

  it('arbitrary numeric threshold passes through', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'nps',
      positiveAction: 'just_thank',
      negativeOptions: ALL_NEG_FLAGS_OFF,
      threshold: 8,
    })
    const branch = steps.find((s) => s.id === 's2_branch')!
    if (branch.type === 'branch_by_score') {
      expect(branch.config.branches[0]!.condition.value).toBe(8)
    }
  })
})

describe('buildCustomStepsFromWizard — full PRD §3.7 example', () => {
  it('CSAT + threshold 4 + redirect_google + ask_aspects + collect_contact (no feedback, no coupon)', () => {
    const steps = buildCustomStepsFromWizard({
      metric: 'csat',
      positiveAction: 'redirect_google',
      negativeOptions: {
        askAspects: true,
        askFeedback: false,
        collectContact: true,
        issueCoupon: false,
      },
      threshold: 4,
    })

    // 7 steps: metric, branch, redirect, end_positive_yes, end_positive_no,
    // aspects, contact, end_negative
    expect(steps).toHaveLength(8)

    const ids = steps.map((s) => s.id).sort()
    expect(ids).toEqual(
      [
        's1_metric',
        's2_branch',
        's3_negative_aspects',
        's3_positive',
        's4_contact',
        's_end_negative',
        's_end_positive_no',
        's_end_positive_yes',
      ].sort(),
    )

    assertGraphIntegrity(steps)
  })
})
