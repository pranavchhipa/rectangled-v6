/**
 * Hotfix PRD §3 (Step A) — Zod validators for the 8 SurveyStep shapes.
 *
 * Mirrors the discriminated union in `../types/survey-steps.ts` 1:1. The
 * canonical TS types remain the source of truth for compile-time checks;
 * these schemas add runtime validation for inputs that arrive over the
 * wire (tRPC `survey.update.steps`, the wizard's "save tree" submit, etc.)
 * or are read back from the JSONB column with no compile-time guarantee.
 *
 * Discriminator key: `type`. Each step has `id` + optional `position` +
 * `config` (type-specific). Default Zod behavior is used (unknown keys
 * silently stripped on parse) so existing data with stale extra fields
 * still validates — we want gradual tightening, not a one-shot break.
 *
 * For "is this thing exactly the expected shape?" we still rely on the
 * TS discriminated union after parsing.
 */

import { z } from 'zod'

// ─── Shared building blocks ─────────────────────────────────────────────

/** Step IDs are arbitrary strings unique within a survey's `steps[]`. */
export const stepRefSchema = z.string().min(1).max(64)

/**
 * Pointer to "the next step", or null/undefined when the edge is open
 * (e.g. a freshly-inserted terminal step, or a branch target that was
 * removed and not yet rewired). The editor uses `null` as its
 * sentinel; the engine treats both null and undefined as "no next
 * step" via falsy checks, so accepting both keeps the FE and engine
 * in sync without forcing the editor to omit keys.
 */
const nextStepRefSchema = stepRefSchema.nullish()
const nextStepRefRequiredKeySchema = stepRefSchema.nullable()

/**
 * Source step reference (e.g. branch_by_score.metricFromStepId,
 * branch_by_answer.answerFromStepId). The editor seeds these as `''`
 * for freshly-added branch nodes that haven't been wired to a source
 * yet, or as undefined when no source has been picked. The engine
 * treats empty/null/undefined as "no source — use defaultNextStepId".
 * Tolerating draft state here lets the owner save partial graphs;
 * a stricter "active survey" guard can re-validate on activation.
 */
const sourceStepRefSchema = z.string().max(64).nullish()

/** Builder canvas coordinates. Engine ignores. Optional everywhere. */
export const stepPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

/**
 * Metric enum — duplicated rather than imported from `./survey` to avoid
 * a circular import. Source of truth: `../constants/journey-metrics.ts`
 * (`JOURNEY_METRICS`).
 */
const surveyMetricSchema = z.enum(['csat', 'nps', 'ces', 'nev', 'cli'])

const baseStepSchema = z.object({
  id: stepRefSchema,
  position: stepPositionSchema.optional(),
})

// ─── ask_metric ─────────────────────────────────────────────────────────

export const askMetricStepSchema = baseStepSchema.extend({
  type: z.literal('ask_metric'),
  config: z.object({
    /** Specific metric, or 'random' to pick from `enabledMetricsForRandom`. */
    metric: z.union([surveyMetricSchema, z.literal('random')]),
    enabledMetricsForRandom: z.array(surveyMetricSchema).optional(),
    question: z.string().min(1),
    scaleLabels: z
      .object({ low: z.string(), high: z.string() })
      .optional(),
    onComplete: z.object({ nextStepId: nextStepRefSchema }),
  }),
})

// ─── ask_question ───────────────────────────────────────────────────────

export const askQuestionFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'select',
  'multi_select',
  'rating',
  'yes_no',
])

export const askQuestionStepSchema = baseStepSchema.extend({
  type: z.literal('ask_question'),
  config: z.object({
    fieldType: askQuestionFieldTypeSchema,
    question: z.string().min(1),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    onComplete: z.object({ nextStepId: nextStepRefSchema }),
  }),
})

// ─── branch_by_score ────────────────────────────────────────────────────

export const branchByScoreOpSchema = z.enum([
  'gte',
  'lte',
  'gt',
  'lt',
  'eq',
  'in',
])

/**
 * `'threshold'` is a sentinel — the engine resolves it against the
 * survey's `settings.thresholds[metricShown]` at runtime. Numeric and
 * array values are taken as literals.
 */
const branchByScoreValueSchema = z.union([
  z.number(),
  z.array(z.number()),
  z.literal('threshold'),
])

export const branchByScoreStepSchema = baseStepSchema.extend({
  type: z.literal('branch_by_score'),
  config: z.object({
    metricFromStepId: sourceStepRefSchema,
    branches: z.array(
      z.object({
        condition: z.object({
          op: branchByScoreOpSchema,
          value: branchByScoreValueSchema,
        }),
        nextStepId: nextStepRefRequiredKeySchema,
        label: z.string().optional(),
      }),
    ),
    defaultNextStepId: nextStepRefRequiredKeySchema,
  }),
})

// ─── branch_by_answer ───────────────────────────────────────────────────

export const branchByAnswerOpSchema = z.enum(['eq', 'in', 'contains'])

const branchByAnswerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
])

export const branchByAnswerStepSchema = baseStepSchema.extend({
  type: z.literal('branch_by_answer'),
  config: z.object({
    answerFromStepId: sourceStepRefSchema,
    branches: z.array(
      z.object({
        condition: z.object({
          op: branchByAnswerOpSchema,
          value: branchByAnswerValueSchema,
        }),
        nextStepId: nextStepRefRequiredKeySchema,
        label: z.string().optional(),
      }),
    ),
    defaultNextStepId: nextStepRefRequiredKeySchema,
  }),
})

// ─── show_message ───────────────────────────────────────────────────────

export const showMessageStepSchema = baseStepSchema.extend({
  type: z.literal('show_message'),
  config: z.object({
    title: z.string().optional(),
    body: z.string().min(1),
    nextStepId: nextStepRefSchema,
  }),
})

// ─── collect_contact ────────────────────────────────────────────────────

export const collectContactFieldKeySchema = z.enum(['name', 'email', 'phone'])

export const collectContactStepSchema = baseStepSchema.extend({
  type: z.literal('collect_contact'),
  config: z.object({
    fields: z.array(
      z.object({
        key: collectContactFieldKeySchema,
        required: z.boolean(),
      }),
    ),
    privacyNote: z.string().optional(),
    nextStepId: nextStepRefSchema,
  }),
})

// ─── redirect ───────────────────────────────────────────────────────────

export const redirectPlatformSchema = z.enum(['google', 'zomato', 'swiggy'])

export const redirectStepSchema = baseStepSchema.extend({
  type: z.literal('redirect'),
  config: z.object({
    platform: redirectPlatformSchema,
    /**
     * Allowed to be empty. The §2 owner banner already surfaces empty-URL
     * surveys for the owner to fix; the engine routes around it. Don't
     * reject otherwise-valid step graphs because of this known data gap.
     */
    url: z.string(),
    reviewTemplate: z.string(),
    yesLabel: z.string(),
    noLabel: z.string(),
    onYesNextStepId: nextStepRefSchema,
    onNoNextStepId: nextStepRefSchema,
  }),
})

// ─── end_journey ────────────────────────────────────────────────────────

export const endJourneyTriggerEventSchema = z.enum([
  'journey_completed_positive',
  'journey_completed_negative',
])

export const endJourneyStepSchema = baseStepSchema.extend({
  type: z.literal('end_journey'),
  config: z.object({
    message: z.string(),
    issueCoupon: z.object({ templateId: z.string() }).optional(),
    triggerEvent: endJourneyTriggerEventSchema.optional(),
  }),
})

// ─── Discriminated union + array shape ──────────────────────────────────

export const surveyStepSchema = z.discriminatedUnion('type', [
  askMetricStepSchema,
  askQuestionStepSchema,
  branchByScoreStepSchema,
  branchByAnswerStepSchema,
  showMessageStepSchema,
  collectContactStepSchema,
  redirectStepSchema,
  endJourneyStepSchema,
])

export const surveyStepsSchema = z.array(surveyStepSchema)

// ─── Inferred TS types (sanity exports) ─────────────────────────────────
//
// Compile-time: assignable from the canonical types in `../types/survey-steps`
// because both follow the same discriminated-union shape. Useful for code
// that wants to talk in `z.infer<typeof askMetricStepSchema>` form.

export type AskMetricStepInput = z.infer<typeof askMetricStepSchema>
export type AskQuestionStepInput = z.infer<typeof askQuestionStepSchema>
export type BranchByScoreStepInput = z.infer<typeof branchByScoreStepSchema>
export type BranchByAnswerStepInput = z.infer<typeof branchByAnswerStepSchema>
export type ShowMessageStepInput = z.infer<typeof showMessageStepSchema>
export type CollectContactStepInput = z.infer<typeof collectContactStepSchema>
export type RedirectStepInput = z.infer<typeof redirectStepSchema>
export type EndJourneyStepInput = z.infer<typeof endJourneyStepSchema>
export type SurveyStepInput = z.infer<typeof surveyStepSchema>
