/**
 * Phase 3 — Survey step library.
 *
 * The 8 typed step kinds the engine knows how to execute. Stored as a JSONB
 * array on `surveys.steps`. The engine walks the graph by reading each
 * step's `onComplete` / `branches` to determine the next step.
 *
 * Step IDs are arbitrary strings unique within a single survey's `steps[]`.
 * Most step types have an `onComplete.nextStepId` pointing at the next
 * step; branch steps have `branches[].nextStepId`. The terminal step
 * (`end_journey`) has no onward link.
 *
 * The engine does NOT mutate the step graph — it reads + computes next
 * step + writes the customer's response to `survey_responses`. The graph
 * is owner-edited via the builder UI (Stage F, deferred).
 */

export type SurveyMetric = 'csat' | 'nps' | 'ces' | 'nev' | 'cli'

export type StepRef = string

export interface BaseStep {
  id: StepRef
  type: string
  /** Builder canvas coordinates. Engine ignores. */
  position?: { x: number; y: number }
}

// --- Metric question -------------------------------------------------------

export interface AskMetricStep extends BaseStep {
  type: 'ask_metric'
  config: {
    /** A specific metric, or 'random' to pick from `enabledMetricsForRandom`. */
    metric: SurveyMetric | 'random'
    enabledMetricsForRandom?: SurveyMetric[]
    question: string
    scaleLabels?: { low: string; high: string }
    onComplete: { nextStepId?: StepRef }
  }
}

// --- Free-form question ----------------------------------------------------

export type AskQuestionFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multi_select'
  | 'rating'
  | 'yes_no'

export interface AskQuestionStep extends BaseStep {
  type: 'ask_question'
  config: {
    fieldType: AskQuestionFieldType
    question: string
    options?: string[] // for select / multi_select
    required?: boolean
    onComplete: { nextStepId?: StepRef }
  }
}

// --- Branch by score (after an AskMetric step) -----------------------------

export type BranchOp = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'in'

export interface BranchByScoreStep extends BaseStep {
  type: 'branch_by_score'
  config: {
    /** Source step that produced the score. */
    metricFromStepId: StepRef
    branches: Array<{
      condition: { op: BranchOp; value: number | number[] | 'threshold' }
      nextStepId: StepRef
      label?: string
    }>
    defaultNextStepId: StepRef
  }
}

// --- Branch by answer (after an AskQuestion step) --------------------------

export interface BranchByAnswerStep extends BaseStep {
  type: 'branch_by_answer'
  config: {
    answerFromStepId: StepRef
    branches: Array<{
      condition: { op: 'eq' | 'in' | 'contains'; value: string | string[] }
      nextStepId: StepRef
      label?: string
    }>
    defaultNextStepId: StepRef
  }
}

// --- Show message / splash -------------------------------------------------

export interface ShowMessageStep extends BaseStep {
  type: 'show_message'
  config: {
    title?: string
    body: string
    nextStepId?: StepRef
  }
}

// --- Collect contact -------------------------------------------------------

export interface CollectContactStep extends BaseStep {
  type: 'collect_contact'
  config: {
    fields: Array<{ key: 'name' | 'email' | 'phone'; required: boolean }>
    privacyNote?: string
    nextStepId?: StepRef
  }
}

// --- Redirect to external review platform ----------------------------------

export interface RedirectStep extends BaseStep {
  type: 'redirect'
  config: {
    platform: 'google' | 'zomato' | 'swiggy'
    url: string
    /** Copied to clipboard before opening the URL. {businessName} interpolated server-side. */
    reviewTemplate: string
    yesLabel: string
    noLabel: string
    onYesNextStepId?: StepRef
    onNoNextStepId?: StepRef
  }
}

// --- Terminal: end journey -------------------------------------------------

export interface EndJourneyStep extends BaseStep {
  type: 'end_journey'
  config: {
    message: string
    /** When set, the engine issues a coupon at completion. */
    issueCoupon?: { templateId: string }
    /** Which automation event to fire. Inferred when omitted. */
    triggerEvent?: 'journey_completed_positive' | 'journey_completed_negative'
  }
}

export type SurveyStep =
  | AskMetricStep
  | AskQuestionStep
  | BranchByScoreStep
  | BranchByAnswerStep
  | ShowMessageStep
  | CollectContactStep
  | RedirectStep
  | EndJourneyStep

export type SurveyStepType = SurveyStep['type']

// --- Type guards (cheap runtime narrowing) ---------------------------------

export function isAskMetric(s: SurveyStep): s is AskMetricStep {
  return s.type === 'ask_metric'
}
export function isAskQuestion(s: SurveyStep): s is AskQuestionStep {
  return s.type === 'ask_question'
}
export function isBranchByScore(s: SurveyStep): s is BranchByScoreStep {
  return s.type === 'branch_by_score'
}
export function isBranchByAnswer(s: SurveyStep): s is BranchByAnswerStep {
  return s.type === 'branch_by_answer'
}
export function isShowMessage(s: SurveyStep): s is ShowMessageStep {
  return s.type === 'show_message'
}
export function isCollectContact(s: SurveyStep): s is CollectContactStep {
  return s.type === 'collect_contact'
}
export function isRedirect(s: SurveyStep): s is RedirectStep {
  return s.type === 'redirect'
}
export function isEndJourney(s: SurveyStep): s is EndJourneyStep {
  return s.type === 'end_journey'
}
