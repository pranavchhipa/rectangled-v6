/**
 * Hotfix PRD §3 — Wizard Custom Journey Builder.
 *
 * Zod validators for the 4-question wizard's answer shape and the
 * tRPC `survey.createFromWizard` mutation input. The wizard's answers
 * are mapped to a step graph by `buildCustomStepsFromWizard` in
 * `../constants/survey-step-builders.ts`.
 *
 * Q1 metric: 'random' short-circuits to `template='adaptive'` (uses §2's
 * AdaptiveEngineService path); the other three values produce a
 * `template='custom'` survey.
 */

import { z } from 'zod'

// ─── Wizard answer shape ────────────────────────────────────────────────

/** Q1 — first metric. 'random' is a wizard-level signal, not a real metric. */
export const wizardMetricSchema = z.enum(['csat', 'nps', 'ces', 'random'])

/** Q2 — what happens when the customer is positive. */
export const wizardPositiveActionSchema = z.enum([
  'redirect_google',
  'redirect_zomato',
  'just_thank',
])

/**
 * Q3 — multi-select for the negative path. Each flag adds a step in the
 * fixed order: aspects → feedback → contact → end. Order chosen for UX
 * (low-effort taps first, high-effort textarea second, sensitive
 * contact info last when the customer is warmed up).
 */
export const wizardNegativeOptionsSchema = z.object({
  askAspects: z.boolean(),
  askFeedback: z.boolean(),
  collectContact: z.boolean(),
  issueCoupon: z.boolean(),
})

/**
 * Full wizard payload. `couponTemplateId` is required when
 * `negativeOptions.issueCoupon === true` AND the workspace has 2+
 * coupon templates; the wizard UI surfaces a sub-dropdown in that
 * case. Server-side resolution: 1 template auto-picks, 0 templates
 * with `issueCoupon === true` is a validation error (the wizard's
 * checkbox should have been disabled).
 */
export const wizardAnswersSchema = z.object({
  metric: wizardMetricSchema,
  positiveAction: wizardPositiveActionSchema,
  negativeOptions: wizardNegativeOptionsSchema,
  threshold: z.number().int(),
  couponTemplateId: z.string().uuid().optional(),
})

// ─── tRPC procedure input ───────────────────────────────────────────────

export const createSurveyFromWizardSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  answers: wizardAnswersSchema,
})

// ─── Inferred TS types ──────────────────────────────────────────────────

export type WizardMetric = z.infer<typeof wizardMetricSchema>
export type WizardPositiveAction = z.infer<typeof wizardPositiveActionSchema>
export type WizardNegativeOptions = z.infer<typeof wizardNegativeOptionsSchema>
export type WizardAnswers = z.infer<typeof wizardAnswersSchema>
export type CreateSurveyFromWizardInput = z.infer<typeof createSurveyFromWizardSchema>
