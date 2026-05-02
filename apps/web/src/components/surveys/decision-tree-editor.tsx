'use client'

/**
 * Hotfix PRD §3.4 — Decision-tree editor for `template='custom'` surveys.
 *
 * Replaces the React Flow canvas with a pre-rendered tree of clickable
 * boxes. Owner clicks a box → edit panel opens on the right; "+Insert
 * step here" buttons appear on the negative chain edges (the positive
 * branch is wizard-locked per PRD §3.5).
 *
 * Layout:
 *
 *   [Rating Question]   ← s1_metric
 *           │
 *   [Route by Score]    ← s2_branch
 *      ↙       ↘
 *  POSITIVE   NEGATIVE
 *   column     column
 *
 * Positive column shape (locked by wizard):
 *   - "just thank" → single Thank-You Screen
 *   - "redirect"   → Review Redirect → Yes-end + No-end (two terminals)
 *
 * Negative column shape (extensible via +Insert):
 *   - Linear chain of optional steps (aspects → feedback → contact)
 *   - Inserted Open-Question / Info-Screen / Contact-Form steps go here
 *   - Always terminates in `s_end_negative`
 *
 * State model:
 *   - `draftSteps` — local SurveyStep[] copy of survey.steps. All edits
 *     mutate this; Save persists via trpc.survey.update.
 *   - `selectedStepId` — controls which step's content shows in the
 *     edit panel.
 *   - `dirty` — flips on any mutation, gates the Save button.
 *
 * Validation: `validateStepGraph` runs after every mutation. Any errors
 * surface in a banner above the tree; Save is disabled while errors
 * exist.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Eye, Loader2, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  STEP_TYPE_LABELS,
  getStepTypeLabel,
  type SurveyStep,
  type SurveyStepType,
  type AskMetricStep,
  type BranchByScoreStep,
  type RedirectStep,
  type EndJourneyStep,
} from '@rectangled/shared'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { validateStepGraph, type ValidationIssue } from '@/lib/step-graph-validation'
import { DecisionTreeEditPanel } from './decision-tree-edit-panel'
import { InsertStepModal } from './insert-step-modal'

// Structural step IDs the wizard always emits. These can never be
// deleted from the editor; their content is editable but their
// presence and position is locked.
const STRUCTURAL_IDS = new Set([
  's1_metric',
  's2_branch',
  's3_positive',
  's_end_positive_yes',
  's_end_positive_no',
  's_end_positive_thanks',
  's_end_negative',
])

interface DecisionTreeEditorProps {
  surveyId: string
  initialSteps: SurveyStep[]
  workspaceId: string
  /** Survey slug — used to open the preview at /j/{slug}?preview=true. */
  slug: string
}

export function DecisionTreeEditor({
  surveyId,
  initialSteps,
  workspaceId,
  slug,
}: DecisionTreeEditorProps) {
  const router = useRouter()
  const utils = trpc.useUtils()

  const [draftSteps, setDraftSteps] = useState<SurveyStep[]>(initialSteps)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [insertAt, setInsertAt] = useState<{ afterStepId: string } | null>(null)

  // Reset when survey id changes (e.g. owner navigates between custom surveys).
  useEffect(() => {
    setDraftSteps(initialSteps)
    setSelectedStepId(null)
    setDirty(false)
  }, [surveyId, initialSteps])

  // Coupon templates for the End-Journey step's coupon dropdown.
  const couponTemplatesQuery = trpc.coupon.listTemplates.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  )
  const couponTemplates = (couponTemplatesQuery.data ?? []) as Array<{
    id: string
    name: string
    isActive: boolean
  }>

  // Validation runs on every render — small graphs, cheap.
  const issues = useMemo(() => validateStepGraph(draftSteps), [draftSteps])
  const hasErrors = issues.some((i) => i.severity === 'error')

  const updateMutation = trpc.survey.update.useMutation({
    onSuccess: () => {
      toast.success('Journey saved')
      utils.survey.getById.invalidate({ id: surveyId })
      utils.survey.list.invalidate()
      setDirty(false)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save journey')
    },
  })

  const archiveMutation = trpc.survey.archive.useMutation({
    onSuccess: () => {
      toast.success('Journey archived')
      router.push('/dashboard/surveys')
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to archive')
    },
  })

  function patchStep(updated: SurveyStep) {
    setDraftSteps((cur) =>
      cur.map((s) => (s.id === updated.id ? updated : s)),
    )
    setDirty(true)
  }

  function deleteStep(stepId: string) {
    if (STRUCTURAL_IDS.has(stepId)) return
    setDraftSteps((cur) => removeStepAndRewire(cur, stepId))
    setSelectedStepId(null)
    setDirty(true)
  }

  function insertStepAfter(afterStepId: string, type: SurveyStepType) {
    setDraftSteps((cur) => insertStepInChain(cur, afterStepId, type))
    setDirty(true)
    setInsertAt(null)
  }

  function handleSave() {
    if (hasErrors) {
      toast.error('Fix the issues below before saving.')
      return
    }
    updateMutation.mutate({
      id: surveyId,
      steps: draftSteps,
    })
  }

  // Parse the graph into the tree structure used by the visual layout.
  const parsed = useMemo(() => parseCustomGraph(draftSteps), [draftSteps])
  const selectedStep = useMemo(
    () => draftSteps.find((s) => s.id === selectedStepId) ?? null,
    [draftSteps, selectedStepId],
  )

  if (!parsed) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Step graph isn't in the expected custom shape.</AlertTitle>
        <AlertDescription>
          The journey is missing the wizard-generated entry (Rating Question →
          Route by Score). It can't be edited in the decision-tree editor —
          archive and re-create from the wizard.
        </AlertDescription>
      </Alert>
    )
  }

  const { metric, branch, positiveStructure, negativeChain } = parsed

  return (
    <div className="space-y-4">
      {/* Validation banner — only when there are errors */}
      {hasErrors && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>This journey can't be saved yet</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs">
              {issues
                .filter((i) => i.severity === 'error')
                .slice(0, 6)
                .map((i, idx) => (
                  <li key={idx}>{i.message}</li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Save row */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        {/* Hotfix PRD §3.6 — preview button. Opens /j/{slug}?preview=true
            in a new tab; the renderer reads the flag and threads it
            through every submit so the engine no-ops persistence. */}
        <Button
          variant="outline"
          onClick={() => {
            if (dirty) {
              toast.info('Save first to preview the latest version.')
              return
            }
            window.open(`/j/${slug}?preview=true`, '_blank', 'noopener,noreferrer')
          }}
          disabled={hasErrors}
        >
          <Eye className="size-4" />
          Preview
        </Button>
        <Button
          onClick={handleSave}
          disabled={!dirty || hasErrors || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      </div>

      {/* Tree + edit panel */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Tree */}
        <Card>
          <CardContent className="p-6">
            <TreeView
              parsed={parsed}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              onInsertAfter={(afterStepId) => setInsertAt({ afterStepId })}
            />
          </CardContent>
        </Card>

        {/* Edit panel */}
        <Card className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-3rem)]">
          {selectedStep ? (
            <DecisionTreeEditPanel
              step={selectedStep}
              onChange={patchStep}
              couponTemplates={couponTemplates}
              canDelete={!STRUCTURAL_IDS.has(selectedStep.id)}
              onDelete={() => deleteStep(selectedStep.id)}
            />
          ) : (
            <CardContent className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <p>Click a step in the tree to edit its content.</p>
              <p className="mt-2 text-xs">
                Use the <strong>+ Insert step here</strong> buttons to add
                Open Questions, Info Screens, or Contact Forms to the
                negative path.
              </p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Insert-step modal */}
      <InsertStepModal
        open={!!insertAt}
        onOpenChange={(o) => {
          if (!o) setInsertAt(null)
        }}
        onPick={(type) => {
          if (insertAt) insertStepAfter(insertAt.afterStepId, type)
        }}
      />
    </div>
  )
}

// ─── Tree visualization ─────────────────────────────────────────────────

interface ParsedGraph {
  metric: AskMetricStep
  branch: BranchByScoreStep
  positiveStructure: PositiveStructure
  negativeChain: SurveyStep[]
}

type PositiveStructure =
  | { kind: 'just_thank'; endStep: EndJourneyStep }
  | {
      kind: 'redirect'
      redirectStep: RedirectStep
      yesEnd: EndJourneyStep | null
      noEnd: EndJourneyStep | null
    }
  | { kind: 'broken' }

function TreeView({
  parsed,
  selectedStepId,
  onSelectStep,
  onInsertAfter,
}: {
  parsed: ParsedGraph
  selectedStepId: string | null
  onSelectStep: (id: string) => void
  onInsertAfter: (afterStepId: string) => void
}) {
  const { metric, branch, positiveStructure, negativeChain } = parsed
  const firstBranch = branch.config.branches[0]
  const op = firstBranch?.condition.op ?? 'gte'
  const threshold = firstBranch?.condition.value
  const positiveLabel =
    op === 'lte'
      ? `Positive (score ≤ ${threshold})`
      : `Positive (score ≥ ${threshold})`

  return (
    <div className="space-y-2">
      {/* Metric */}
      <div className="flex justify-center">
        <StepBox
          step={metric}
          selected={selectedStepId === metric.id}
          onClick={() => onSelectStep(metric.id)}
        />
      </div>
      <Connector />
      {/* Branch */}
      <div className="flex justify-center">
        <StepBox
          step={branch}
          selected={selectedStepId === branch.id}
          onClick={() => onSelectStep(branch.id)}
        />
      </div>

      {/* Fork into two columns */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        {/* Positive column */}
        <div className="space-y-2">
          <BranchLabel tone="positive">{positiveLabel}</BranchLabel>
          <Connector />
          <PositiveColumn
            structure={positiveStructure}
            selectedStepId={selectedStepId}
            onSelectStep={onSelectStep}
          />
        </div>

        {/* Negative column */}
        <div className="space-y-2">
          <BranchLabel tone="negative">Negative</BranchLabel>
          <Connector />
          <NegativeColumn
            chain={negativeChain}
            selectedStepId={selectedStepId}
            onSelectStep={onSelectStep}
            onInsertAfter={onInsertAfter}
          />
        </div>
      </div>
    </div>
  )
}

function PositiveColumn({
  structure,
  selectedStepId,
  onSelectStep,
}: {
  structure: PositiveStructure
  selectedStepId: string | null
  onSelectStep: (id: string) => void
}) {
  if (structure.kind === 'broken') {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Positive path is missing.
      </div>
    )
  }
  if (structure.kind === 'just_thank') {
    return (
      <div className="flex justify-center">
        <StepBox
          step={structure.endStep}
          selected={selectedStepId === structure.endStep.id}
          onClick={() => onSelectStep(structure.endStep.id)}
        />
      </div>
    )
  }
  // redirect kind — redirect on top, yes/no terminals stacked
  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <StepBox
          step={structure.redirectStep}
          selected={selectedStepId === structure.redirectStep.id}
          onClick={() => onSelectStep(structure.redirectStep.id)}
        />
      </div>
      <Connector />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            tapped Yes
          </div>
          {structure.yesEnd ? (
            <StepBox
              step={structure.yesEnd}
              selected={selectedStepId === structure.yesEnd.id}
              onClick={() => onSelectStep(structure.yesEnd!.id)}
            />
          ) : (
            <BrokenBox label="missing" />
          )}
        </div>
        <div className="space-y-1.5">
          <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            tapped No
          </div>
          {structure.noEnd ? (
            <StepBox
              step={structure.noEnd}
              selected={selectedStepId === structure.noEnd.id}
              onClick={() => onSelectStep(structure.noEnd!.id)}
            />
          ) : (
            <BrokenBox label="missing" />
          )}
        </div>
      </div>
    </div>
  )
}

function NegativeColumn({
  chain,
  selectedStepId,
  onSelectStep,
  onInsertAfter,
}: {
  chain: SurveyStep[]
  selectedStepId: string | null
  onSelectStep: (id: string) => void
  onInsertAfter: (afterStepId: string) => void
}) {
  if (chain.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Negative path is missing.
      </div>
    )
  }

  // Render each step + an InsertEdge between non-terminal pairs.
  // Insert can happen anywhere on the chain EXCEPT after the terminal
  // end_journey (no successor to point at).
  return (
    <div className="space-y-2">
      {chain.map((step, i) => {
        const isLast = i === chain.length - 1
        const showInsertAfter = !isLast && step.type !== 'end_journey'
        return (
          <div key={step.id} className="space-y-2">
            <div className="flex justify-center">
              <StepBox
                step={step}
                selected={selectedStepId === step.id}
                onClick={() => onSelectStep(step.id)}
              />
            </div>
            {/* Connector + Insert button between consecutive non-terminal steps */}
            {showInsertAfter && (
              <>
                <InsertEdge onClick={() => onInsertAfter(step.id)} />
              </>
            )}
            {!isLast && !showInsertAfter && <Connector />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Visual primitives ──────────────────────────────────────────────────

function StepBox({
  step,
  selected,
  onClick,
}: {
  step: SurveyStep
  selected: boolean
  onClick: () => void
}) {
  const meta = getStepTypeLabel(step.type)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group min-w-[200px] max-w-full rounded-lg border-2 px-3 py-2.5 text-left shadow-sm transition',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-input bg-background hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden>{meta.icon}</span>
        <span>{meta.label}</span>
      </div>
      <StepPreview step={step} />
    </button>
  )
}

function StepPreview({ step }: { step: SurveyStep }) {
  let preview: string = step.id
  switch (step.type) {
    case 'ask_metric':
      preview = step.config.question
      break
    case 'ask_question':
      preview = step.config.question
      break
    case 'show_message':
      preview = step.config.title || step.config.body
      break
    case 'collect_contact':
      preview = `${step.config.fields.length} field${step.config.fields.length === 1 ? '' : 's'}`
      break
    case 'redirect':
      preview = step.config.url || '(URL not set)'
      break
    case 'branch_by_score': {
      const b = step.config.branches[0]
      const op = b?.condition.op === 'lte' ? '≤' : '≥'
      preview = `Positive when score ${op} ${String(b?.condition.value ?? '?')}`
      break
    }
    case 'branch_by_answer':
      preview = `${step.config.branches.length} condition(s)`
      break
    case 'end_journey':
      preview = step.config.message
      break
  }
  return (
    <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
      {preview}
    </div>
  )
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="h-4 w-px bg-border" />
    </div>
  )
}

function BranchLabel({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'positive' | 'negative'
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
        tone === 'positive'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-rose-50 text-rose-700',
      )}
    >
      {children}
    </div>
  )
}

function BrokenBox({ label }: { label: string }) {
  return (
    <div className="rounded-md border-2 border-dashed border-rose-300 bg-rose-50 p-3 text-center text-xs text-rose-700">
      {label}
    </div>
  )
}

function InsertEdge({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-2 w-px bg-border" />
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        onClick={onClick}
      >
        <Plus className="size-3" />
        Insert step here
      </Button>
      <div className="h-2 w-px bg-border" />
    </div>
  )
}

// ─── Graph helpers ──────────────────────────────────────────────────────

function parseCustomGraph(steps: SurveyStep[]): ParsedGraph | null {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const metric = byId.get('s1_metric')
  const branch = byId.get('s2_branch')
  if (!metric || metric.type !== 'ask_metric') return null
  if (!branch || branch.type !== 'branch_by_score') return null

  // Positive structure
  const positiveEntryId = branch.config.branches[0]?.nextStepId
  const positiveEntry = positiveEntryId ? byId.get(positiveEntryId) : undefined

  let positiveStructure: PositiveStructure
  if (!positiveEntry) {
    positiveStructure = { kind: 'broken' }
  } else if (positiveEntry.type === 'end_journey') {
    positiveStructure = { kind: 'just_thank', endStep: positiveEntry }
  } else if (positiveEntry.type === 'redirect') {
    const yes = byId.get(positiveEntry.config.onYesNextStepId ?? '')
    const no = byId.get(positiveEntry.config.onNoNextStepId ?? '')
    positiveStructure = {
      kind: 'redirect',
      redirectStep: positiveEntry,
      yesEnd: yes && yes.type === 'end_journey' ? yes : null,
      noEnd: no && no.type === 'end_journey' ? no : null,
    }
  } else {
    positiveStructure = { kind: 'broken' }
  }

  // Negative chain — walk via single-next pointers, stop at end_journey.
  const negativeChain: SurveyStep[] = []
  const seen = new Set<string>()
  let currId: string | undefined = branch.config.defaultNextStepId
  while (currId && !seen.has(currId)) {
    const s = byId.get(currId)
    if (!s) break
    seen.add(currId)
    negativeChain.push(s)
    if (s.type === 'end_journey') break
    if (s.type === 'ask_metric' || s.type === 'ask_question') {
      currId = s.config.onComplete.nextStepId
    } else if (s.type === 'show_message' || s.type === 'collect_contact') {
      currId = s.config.nextStepId
    } else {
      currId = undefined
    }
  }

  return { metric, branch, positiveStructure, negativeChain }
}

/**
 * Insert a new step of the given type AFTER the step with id `afterStepId`,
 * rewiring pointers so the chain stays intact:
 *
 *   before: [afterStep] → [oldSuccessor]
 *   after:  [afterStep] → [newStep] → [oldSuccessor]
 *
 * Only used for the negative chain — which has linear single-next
 * pointers, so this stays simple.
 */
function insertStepInChain(
  steps: SurveyStep[],
  afterStepId: string,
  type: SurveyStepType,
): SurveyStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const after = byId.get(afterStepId)
  if (!after) return steps

  const oldSuccessor = singleNextOf(after)
  if (!oldSuccessor) return steps

  const newId = `${type}_${Math.random().toString(36).slice(2, 8)}`
  const newStep = makeDefaultStep(type, newId, oldSuccessor)

  const rewiredAfter = setSingleNextOf(after, newId)
  if (!rewiredAfter) return steps

  return steps.map((s) => (s.id === after.id ? rewiredAfter : s)).concat([newStep])
}

/**
 * Remove a step and rewire whoever pointed at it to point at IT'S
 * successor. Only safe for steps with a single outgoing pointer
 * (negative-chain only — structural steps are gated by STRUCTURAL_IDS
 * upstream).
 */
function removeStepAndRewire(steps: SurveyStep[], stepId: string): SurveyStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const target = byId.get(stepId)
  if (!target) return steps

  const successor = singleNextOf(target)
  if (!successor) return steps.filter((s) => s.id !== stepId)

  return steps
    .filter((s) => s.id !== stepId)
    .map((s) => {
      // Rewire any step pointing at the deleted target so it skips
      // straight to the deleted target's successor.
      const next = singleNextOf(s)
      if (next === stepId) {
        return setSingleNextOf(s, successor) ?? s
      }
      return s
    })
}

function singleNextOf(s: SurveyStep): string | undefined {
  switch (s.type) {
    case 'ask_metric':
    case 'ask_question':
      return s.config.onComplete.nextStepId
    case 'show_message':
    case 'collect_contact':
      return s.config.nextStepId
    default:
      return undefined
  }
}

function setSingleNextOf(s: SurveyStep, nextId: string): SurveyStep | null {
  switch (s.type) {
    case 'ask_metric':
      return {
        ...s,
        config: {
          ...s.config,
          onComplete: { ...s.config.onComplete, nextStepId: nextId },
        },
      }
    case 'ask_question':
      return {
        ...s,
        config: {
          ...s.config,
          onComplete: { ...s.config.onComplete, nextStepId: nextId },
        },
      }
    case 'show_message':
      return { ...s, config: { ...s.config, nextStepId: nextId } }
    case 'collect_contact':
      return { ...s, config: { ...s.config, nextStepId: nextId } }
    default:
      return null
  }
}

function makeDefaultStep(
  type: SurveyStepType,
  id: string,
  nextStepId: string,
): SurveyStep {
  const meta = STEP_TYPE_LABELS[type]
  switch (type) {
    case 'ask_question':
      return {
        id,
        type: 'ask_question',
        config: {
          fieldType: 'textarea',
          question: meta.label,
          required: false,
          onComplete: { nextStepId },
        },
      }
    case 'show_message':
      return {
        id,
        type: 'show_message',
        config: {
          body: 'Edit me.',
          nextStepId,
        },
      }
    case 'collect_contact':
      return {
        id,
        type: 'collect_contact',
        config: {
          fields: [
            { key: 'name', required: false },
            { key: 'phone', required: false },
            { key: 'email', required: false },
          ],
          nextStepId,
        },
      }
    default:
      // Other types aren't insertable per PRD §3.5; this branch is
      // unreachable from the UI but kept for type-completeness.
      throw new Error(`Step type ${type} is not insertable from the editor.`)
  }
}
