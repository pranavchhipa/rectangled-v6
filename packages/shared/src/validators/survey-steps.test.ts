/**
 * Hotfix PRD §3 (Step A) — validator unit tests.
 *
 * One valid + one invalid case per step type. The "valid" case mirrors
 * the actual shape that `buildQuickIntelligentSteps` /
 * `buildDeepIntelligentSteps` emit, so this catches drift between the
 * engine's seeders and the wire-level validator.
 */

import { describe, it, expect } from 'vitest'
import {
  askMetricStepSchema,
  askQuestionStepSchema,
  branchByScoreStepSchema,
  branchByAnswerStepSchema,
  showMessageStepSchema,
  collectContactStepSchema,
  redirectStepSchema,
  endJourneyStepSchema,
  surveyStepSchema,
  surveyStepsSchema,
} from './survey-steps'

describe('askMetricStepSchema', () => {
  it('accepts a random-metric ask_metric step', () => {
    const ok = askMetricStepSchema.safeParse({
      id: 's1_metric',
      type: 'ask_metric',
      position: { x: 0, y: 0 },
      config: {
        metric: 'random',
        enabledMetricsForRandom: ['csat', 'nps', 'ces', 'nev', 'cli'],
        question: 'How was your experience?',
        onComplete: { nextStepId: 's2_branch' },
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a step with an unknown metric', () => {
    const bad = askMetricStepSchema.safeParse({
      id: 's1',
      type: 'ask_metric',
      config: {
        metric: 'made_up_metric',
        question: 'Q',
        onComplete: {},
      },
    })
    expect(bad.success).toBe(false)
  })
})

describe('askQuestionStepSchema', () => {
  it('accepts a multi_select with options', () => {
    const ok = askQuestionStepSchema.safeParse({
      id: 's3_unhappy',
      type: 'ask_question',
      config: {
        fieldType: 'multi_select',
        question: 'What went wrong?',
        options: ['Service', 'Quality', 'Wait time'],
        required: false,
        onComplete: { nextStepId: 's3b_unhappy_contact' },
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a step with an unknown fieldType', () => {
    const bad = askQuestionStepSchema.safeParse({
      id: 's1',
      type: 'ask_question',
      config: {
        fieldType: 'slider',
        question: 'Q',
        onComplete: {},
      },
    })
    expect(bad.success).toBe(false)
  })
})

describe('branchByScoreStepSchema', () => {
  it('accepts the threshold sentinel value', () => {
    const ok = branchByScoreStepSchema.safeParse({
      id: 's2_branch',
      type: 'branch_by_score',
      config: {
        metricFromStepId: 's1_metric',
        branches: [
          {
            condition: { op: 'gte', value: 'threshold' },
            nextStepId: 's3_happy',
            label: 'happy',
          },
        ],
        defaultNextStepId: 's3_unhappy',
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a non-numeric, non-threshold value', () => {
    const bad = branchByScoreStepSchema.safeParse({
      id: 's2',
      type: 'branch_by_score',
      config: {
        metricFromStepId: 's1',
        branches: [
          {
            condition: { op: 'gte', value: 'high' }, // bogus literal
            nextStepId: 's3',
          },
        ],
        defaultNextStepId: 's4',
      },
    })
    expect(bad.success).toBe(false)
  })
})

describe('branchByAnswerStepSchema', () => {
  it('accepts a contains-on-multiselect branch', () => {
    const ok = branchByAnswerStepSchema.safeParse({
      id: 'b1',
      type: 'branch_by_answer',
      config: {
        answerFromStepId: 'q1',
        branches: [
          {
            condition: { op: 'contains', value: 'food' },
            nextStepId: 'food_path',
          },
        ],
        defaultNextStepId: 'default_path',
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a numeric branch value (wrong type for answer-branch)', () => {
    const bad = branchByAnswerStepSchema.safeParse({
      id: 'b1',
      type: 'branch_by_answer',
      config: {
        answerFromStepId: 'q1',
        branches: [
          {
            condition: { op: 'eq', value: 5 },
            nextStepId: 'p',
          },
        ],
        defaultNextStepId: 'd',
      },
    })
    expect(bad.success).toBe(false)
  })
})

describe('showMessageStepSchema', () => {
  it('accepts a body-only show_message', () => {
    const ok = showMessageStepSchema.safeParse({
      id: 's3_passive',
      type: 'show_message',
      config: { body: 'Your input helps us improve.', nextStepId: 's4' },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a step with empty body', () => {
    const bad = showMessageStepSchema.safeParse({
      id: 's3',
      type: 'show_message',
      config: { body: '' },
    })
    expect(bad.success).toBe(false)
  })
})

describe('collectContactStepSchema', () => {
  it('accepts the standard 3-field contact step', () => {
    const ok = collectContactStepSchema.safeParse({
      id: 's3b_unhappy_contact',
      type: 'collect_contact',
      config: {
        fields: [
          { key: 'name', required: false },
          { key: 'email', required: false },
          { key: 'phone', required: false },
        ],
        privacyNote: 'We will only use this to follow up.',
        nextStepId: 's4',
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a contact step with an unknown field key', () => {
    const bad = collectContactStepSchema.safeParse({
      id: 's1',
      type: 'collect_contact',
      config: {
        fields: [{ key: 'address', required: false }], // not in enum
      },
    })
    expect(bad.success).toBe(false)
  })
})

describe('redirectStepSchema', () => {
  it('accepts a redirect with empty url (known data gap)', () => {
    const ok = redirectStepSchema.safeParse({
      id: 's3_happy',
      type: 'redirect',
      config: {
        platform: 'google',
        url: '', // intentionally empty — owner banner surfaces the gap
        reviewTemplate: 'Had a great experience at {businessName}!',
        yesLabel: 'Sure',
        noLabel: 'Maybe later',
        onYesNextStepId: 's4_thanks_yes',
        onNoNextStepId: 's4_thanks_no',
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects a redirect with an unknown platform', () => {
    const bad = redirectStepSchema.safeParse({
      id: 's3',
      type: 'redirect',
      config: {
        platform: 'tripadvisor', // not in enum
        url: 'https://example.com',
        reviewTemplate: 't',
        yesLabel: 'y',
        noLabel: 'n',
      },
    })
    expect(bad.success).toBe(false)
  })
})

describe('endJourneyStepSchema', () => {
  it('accepts a terminal end_journey with triggerEvent + coupon', () => {
    const ok = endJourneyStepSchema.safeParse({
      id: 's4_thanks_yes',
      type: 'end_journey',
      config: {
        message: 'Thank you!',
        issueCoupon: { templateId: 'tpl-1' },
        triggerEvent: 'journey_completed_positive',
      },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects an unknown triggerEvent', () => {
    const bad = endJourneyStepSchema.safeParse({
      id: 's4',
      type: 'end_journey',
      config: {
        message: 'Thanks',
        triggerEvent: 'journey_completed', // missing _positive/_negative suffix
      },
    })
    expect(bad.success).toBe(false)
  })
})

/**
 * Phase: Form builder defaults — every shape that
 * `defaultConfigFor(type)` in apps/web/src/app/dashboard/journeys/[id]/
 * page.tsx produces for a freshly-added step must round-trip through
 * the validator without erroring. These steps are saved IMMEDIATELY on
 * insertion (handleAddStep → updateMutation.mutate), so any validator
 * rejection blocks the owner from adding the step at all.
 *
 * Mirror each `defaultConfigFor` case verbatim. If the editor's defaults
 * change, mirror the change here so this regression test catches drift.
 */
describe('fresh step defaults from journey editor', () => {
  it('Rating Question — ask_metric default config', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'ask_metric',
      config: {
        metric: 'csat',
        question: 'How was your experience?',
        onComplete: { nextStepId: null },
      },
    })
    expect(r.success).toBe(true)
  })

  it('Open Question — ask_question default config', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'ask_question',
      config: {
        fieldType: 'textarea',
        question: 'Tell us more',
        required: false,
        onComplete: { nextStepId: null },
      },
    })
    expect(r.success).toBe(true)
  })

  it('Route by Score — branch_by_score default config (empty source, no branches yet)', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'branch_by_score',
      config: {
        metricFromStepId: '', // FE seeds empty until user wires it
        branches: [],
        defaultNextStepId: null,
      },
    })
    expect(r.success).toBe(true)
  })

  it('Route by Answer — branch_by_answer default config (null source, no branches yet)', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'branch_by_answer',
      config: {
        answerFromStepId: null,
        branches: [],
        defaultNextStepId: null,
      },
    })
    expect(r.success).toBe(true)
  })

  it('Info Screen — show_message default config', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'show_message',
      config: {
        title: 'Heads up',
        body: 'Some helpful copy here.',
        nextStepId: null,
      },
    })
    expect(r.success).toBe(true)
  })

  it('Contact Form — collect_contact default config', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'collect_contact',
      config: {
        fields: [
          { key: 'name', required: false },
          { key: 'email', required: false },
          { key: 'phone', required: false },
        ],
        privacyNote: '',
        nextStepId: null,
      },
    })
    expect(r.success).toBe(true)
  })

  it('Review Redirect — redirect default config (null next pointers)', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'redirect',
      config: {
        platform: 'google',
        url: '',
        reviewTemplate: '',
        yesLabel: 'Sure',
        noLabel: 'Maybe later',
        onYesNextStepId: null,
        onNoNextStepId: null,
      },
    })
    expect(r.success).toBe(true)
  })

  it('Thank You Screen — end_journey default config', () => {
    const r = surveyStepSchema.safeParse({
      id: 's_new',
      type: 'end_journey',
      config: { message: 'Thank you!' },
    })
    expect(r.success).toBe(true)
  })
})

describe('surveyStepSchema (discriminated union)', () => {
  it('routes by `type` discriminator', () => {
    const askMetric = surveyStepSchema.safeParse({
      id: 's1',
      type: 'ask_metric',
      config: {
        metric: 'csat',
        question: 'Q',
        onComplete: {},
      },
    })
    expect(askMetric.success).toBe(true)

    const endJourney = surveyStepSchema.safeParse({
      id: 's4',
      type: 'end_journey',
      config: { message: 'done' },
    })
    expect(endJourney.success).toBe(true)
  })
  it('rejects an unknown discriminator value', () => {
    const bad = surveyStepSchema.safeParse({
      id: 's1',
      type: 'ask_phone_number', // not one of the 8
      config: {},
    })
    expect(bad.success).toBe(false)
  })
})

describe('surveyStepsSchema (array)', () => {
  it('accepts a complete buildQuickIntelligentSteps-style graph', () => {
    const graph = [
      {
        id: 's1_metric',
        type: 'ask_metric',
        position: { x: 0, y: 0 },
        config: {
          metric: 'random',
          enabledMetricsForRandom: ['csat', 'nps', 'ces', 'nev', 'cli'],
          question: 'How was your experience?',
          onComplete: { nextStepId: 's2_branch' },
        },
      },
      {
        id: 's2_branch',
        type: 'branch_by_score',
        position: { x: 0, y: 200 },
        config: {
          metricFromStepId: 's1_metric',
          branches: [
            {
              condition: { op: 'gte', value: 'threshold' },
              nextStepId: 's3_happy',
              label: 'happy',
            },
          ],
          defaultNextStepId: 's3_unhappy',
        },
      },
      {
        id: 's3_happy',
        type: 'redirect',
        config: {
          platform: 'google',
          url: '',
          reviewTemplate: 'Had a great experience at {businessName}!',
          yesLabel: 'Sure',
          noLabel: 'Maybe later',
          onYesNextStepId: 's4_thanks_yes',
          onNoNextStepId: 's4_thanks_no',
        },
      },
      {
        id: 's4_thanks_yes',
        type: 'end_journey',
        config: { message: 'Thanks!', triggerEvent: 'journey_completed_positive' },
      },
      {
        id: 's4_thanks_no',
        type: 'end_journey',
        config: { message: 'Bye', triggerEvent: 'journey_completed_positive' },
      },
      {
        id: 's3_unhappy',
        type: 'ask_question',
        config: {
          fieldType: 'multi_select',
          question: 'What went wrong?',
          options: ['Service', 'Quality'],
          required: false,
          onComplete: { nextStepId: 's3b_unhappy_contact' },
        },
      },
      {
        id: 's3b_unhappy_contact',
        type: 'collect_contact',
        config: {
          fields: [
            { key: 'name', required: false },
            { key: 'email', required: false },
            { key: 'phone', required: false },
          ],
          privacyNote: 'We will only use this to follow up.',
          nextStepId: 's4_thanks_unhappy',
        },
      },
      {
        id: 's4_thanks_unhappy',
        type: 'end_journey',
        config: {
          message: 'Sorry to hear that.',
          triggerEvent: 'journey_completed_negative',
        },
      },
    ]
    const result = surveyStepsSchema.safeParse(graph)
    expect(result.success).toBe(true)
  })
  it('reports the index of the failing step', () => {
    const graph = [
      {
        id: 's1',
        type: 'ask_metric',
        config: {
          metric: 'csat',
          question: 'Q',
          onComplete: {},
        },
      },
      {
        id: 's2',
        type: 'redirect',
        config: { platform: 'made_up', url: '', reviewTemplate: 't', yesLabel: 'y', noLabel: 'n' },
      },
    ]
    const result = surveyStepsSchema.safeParse(graph)
    expect(result.success).toBe(false)
    if (!result.success) {
      // The first issue should point at index 1 (the bad redirect step).
      expect(result.error.issues[0]?.path[0]).toBe(1)
    }
  })
})
