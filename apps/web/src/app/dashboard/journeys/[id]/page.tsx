'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft,
  Save,
  ExternalLink,
  Loader2,
  Sparkles,
  HelpCircle,
  GitBranch,
  MessageSquare,
  UserPlus,
  ExternalLink as RedirectIcon,
  Flag,
  Info,
  Plus,
  Trash2,
  QrCode,
  Download,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ResponsesList } from '@/components/responses/responses-list'
import { AdaptiveSettingsForm } from '@/components/surveys/adaptive-settings-form'
import { DecisionTreeEditor } from '@/components/surveys/decision-tree-editor'
import type { SurveyStep, SurveyStepType } from '@rectangled/shared'
import { STEP_TYPE_LABELS, getStepTypeLabel } from '@rectangled/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Phase 3 Stage F — Survey editor with React Flow visualization.
 *
 * MVP scope:
 *   - Edit survey metadata (name, status).
 *   - Visualize the step graph as a read-only React Flow canvas.
 *     Nodes are positioned from each step's `position` field (the
 *     intelligent builders pre-set sensible coordinates).
 *   - Click a node to open a side sheet with a form to edit that
 *     step's config (label, question text, message copy, etc).
 *     Save persists the entire steps array via survey.update.
 *   - Edges drawn from each step's "next" field per step kind.
 *
 * Deferred (proper "builder mode" — needs UX direction):
 *   - Drag to add new steps from a palette.
 *   - Drag to connect / re-route edges.
 *   - Validation + dead-end detection in the canvas.
 */

type StepConfig = Record<string, unknown>
type Step = {
  id: string
  type: string
  position?: { x: number; y: number }
  config: StepConfig
}

/**
 * Cast helper for the wire boundary.
 *
 * The canvas editor uses a loose local `Step` type so it can manipulate
 * `step.config` as a generic record (one set of textareas / inputs for
 * any step kind) without per-type narrowing in every handler. The
 * `survey.update` validator (Hotfix §3 Step A) is strict — it enforces
 * the 8-way discriminated union from `validators/survey-steps.ts`.
 *
 * This cast bridges them. If the canvas editor ever produces a step
 * shape that doesn't match the validator, the server rejects on submit
 * (TRPCError → toast), so we don't lose the safety the validator gives
 * us — we just defer the check to the wire instead of carrying it
 * everywhere in the editor's local state.
 */
function toWireSteps(steps: Step[]): SurveyStep[] {
  return steps as unknown as SurveyStep[]
}

/**
 * Canvas-only visual map: Tailwind color classes + Lucide icon component
 * per step kind. The owner-facing label/description/emoji icon lives
 * separately in `STEP_TYPE_LABELS` (`@rectangled/shared`); this map
 * stays here because the Lucide icon component refs and Tailwind class
 * strings are canvas-specific implementation details.
 */
const STEP_KIND_VISUAL: Record<
  string,
  { color: string; icon: typeof Sparkles }
> = {
  ask_metric: { color: 'border-blue-400 bg-blue-50', icon: Sparkles },
  ask_question: { color: 'border-violet-400 bg-violet-50', icon: HelpCircle },
  branch_by_score: { color: 'border-amber-400 bg-amber-50', icon: GitBranch },
  branch_by_answer: { color: 'border-amber-400 bg-amber-50', icon: GitBranch },
  show_message: { color: 'border-slate-300 bg-slate-50', icon: MessageSquare },
  collect_contact: { color: 'border-emerald-300 bg-emerald-50', icon: UserPlus },
  redirect: { color: 'border-cyan-300 bg-cyan-50', icon: RedirectIcon },
  end_journey: { color: 'border-rose-300 bg-rose-50', icon: Flag },
}

/**
 * Walk each step's config to produce the React Flow edge list. The
 * survey-engine code does the same walk at runtime; we mirror it
 * loosely here for visualization. Anything not understood becomes a
 * dashed dead-end edge into a synthetic "?" node so the user spots it.
 */
function buildEdges(steps: Step[]): Edge[] {
  const stepIds = new Set(steps.map((s) => s.id))
  const edges: Edge[] = []
  const push = (
    fromId: string,
    toId: string | null | undefined,
    label?: string,
  ) => {
    if (!toId) return
    const valid = stepIds.has(toId)
    edges.push({
      id: `${fromId}__${toId}__${label ?? ''}__${edges.length}`,
      source: fromId,
      target: toId,
      label,
      animated: !valid,
      style: valid ? undefined : { stroke: '#dc2626', strokeDasharray: '4 4' },
    })
  }

  for (const s of steps) {
    const c = s.config as any
    switch (s.type) {
      case 'ask_metric':
      case 'ask_question':
        push(s.id, c?.onComplete?.nextStepId)
        break
      case 'show_message':
      case 'collect_contact':
        push(s.id, c?.nextStepId)
        break
      case 'branch_by_score':
      case 'branch_by_answer':
        for (const b of (c?.branches ?? []) as Array<{
          nextStepId: string
          label?: string
        }>) {
          push(s.id, b.nextStepId, b.label)
        }
        push(s.id, c?.defaultNextStepId, 'else')
        break
      case 'redirect':
        push(s.id, c?.onYesNextStepId, 'yes')
        push(s.id, c?.onNoNextStepId, 'no')
        break
      case 'end_journey':
        // terminal — no outgoing edges.
        break
    }
  }
  return edges
}

function buildNodes(steps: Step[], onPick: (step: Step) => void): Node[] {
  return steps.map((s, i) => {
    const visual = STEP_KIND_VISUAL[s.type] ?? {
      color: 'border-slate-300 bg-slate-50',
      icon: Info,
    }
    const Icon = visual.icon
    const ownerLabel = getStepTypeLabel(s.type).label
    return {
      id: s.id,
      type: 'default',
      position: s.position ?? { x: (i % 3) * 240, y: Math.floor(i / 3) * 180 },
      data: {
        label: (
          <div
            className={`min-w-[160px] cursor-pointer rounded-lg border-2 px-3 py-2 text-left shadow-sm ${visual.color}`}
            onClick={() => onPick(s)}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3" />
              {ownerLabel}
            </div>
            <div className="mt-1 truncate text-sm font-medium">{s.id}</div>
          </div>
        ) as unknown as string,
      },
      style: { background: 'transparent', border: 'none', padding: 0 },
    }
  })
}

/**
 * Phase 3 Stage F follow-up — pure helpers for the manual builder.
 */

/**
 * Set the "next" pointer on a step's config to `targetId` for step
 * kinds that have a single outgoing edge. Returns null when the step
 * has multiple (or zero) outgoing edges — caller opens the editor
 * sheet in that case so the user picks explicitly.
 */
function setNextPointer(step: Step, targetId: string): StepConfig | null {
  const c = step.config as any
  switch (step.type) {
    case 'ask_metric':
    case 'ask_question':
      return {
        ...c,
        onComplete: { ...(c.onComplete ?? {}), nextStepId: targetId },
      }
    case 'show_message':
    case 'collect_contact':
      return { ...c, nextStepId: targetId }
    case 'branch_by_score':
    case 'branch_by_answer':
    case 'redirect':
    case 'end_journey':
      // Multiple / zero outgoing — needs explicit routing.
      return null
    default:
      return null
  }
}

/**
 * Walk a step's config and null-out any pointer that targets `removedId`.
 * Used after a step is deleted so dangling pointers go to red-dashed
 * dead-ends instead of pointing at a step that no longer exists.
 */
function clearPointersTo(step: Step, removedId: string): Step {
  const c = step.config as any
  let changed = false
  let next: any = c
  const nuke = (path: (cfg: any) => unknown, set: (cfg: any) => any) => {
    if (path(next) === removedId) {
      next = set(next)
      changed = true
    }
  }
  switch (step.type) {
    case 'ask_metric':
    case 'ask_question':
      nuke(
        (cfg) => cfg?.onComplete?.nextStepId,
        (cfg) => ({
          ...cfg,
          onComplete: { ...(cfg.onComplete ?? {}), nextStepId: null },
        }),
      )
      break
    case 'show_message':
    case 'collect_contact':
      nuke(
        (cfg) => cfg?.nextStepId,
        (cfg) => ({ ...cfg, nextStepId: null }),
      )
      break
    case 'redirect':
      nuke(
        (cfg) => cfg?.onYesNextStepId,
        (cfg) => ({ ...cfg, onYesNextStepId: null }),
      )
      nuke(
        (cfg) => cfg?.onNoNextStepId,
        (cfg) => ({ ...cfg, onNoNextStepId: null }),
      )
      break
    case 'branch_by_score':
    case 'branch_by_answer':
      if (Array.isArray(c.branches)) {
        const nb = (c.branches as Array<{ nextStepId: string }>).map((b) =>
          b.nextStepId === removedId ? { ...b, nextStepId: null as any } : b,
        )
        if (nb.some((b: any, i) => b !== c.branches[i])) {
          next = { ...next, branches: nb }
          changed = true
        }
      }
      nuke(
        (cfg) => cfg?.defaultNextStepId,
        (cfg) => ({ ...cfg, defaultNextStepId: null }),
      )
      break
  }
  return changed ? { ...step, config: next } : step
}

/**
 * Order surfaced in the "+ Add step" palette. Labels and descriptions
 * are looked up from `STEP_TYPE_LABELS` at render time so this list
 * only governs ORDER, not copy.
 */
const STEP_TYPES_FOR_PALETTE: SurveyStepType[] = [
  'ask_metric',
  'ask_question',
  'branch_by_score',
  'branch_by_answer',
  'show_message',
  'collect_contact',
  'redirect',
  'end_journey',
]

export default function SurveyEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const utils = trpc.useUtils()

  const [editingStep, setEditingStep] = useState<Step | null>(null)
  const [stepDraft, setStepDraft] = useState<StepConfig>({})
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft')
  const [dirty, setDirty] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  // Phase 3 Stage F follow-up — friendly "Easy edit" panel state.
  // Mirrors a flattened view of the user-facing fields buried in the
  // step graph. Saving walks the steps and patches each step's config.
  const [easy, setEasy] = useState<{
    question: string
    thankYouMessage: string
    followupQuestion: string // deep template only
    reviewPlatform: string // quick template
    redirectUrl: string // quick
    reviewTemplate: string // quick
    aspectTagsCsv: string // quick
    brandColor: string // deep
  }>({
    question: '',
    thankYouMessage: '',
    followupQuestion: '',
    reviewPlatform: 'google',
    redirectUrl: '',
    reviewTemplate: '',
    aspectTagsCsv: '',
    brandColor: '',
  })
  const [easyDirty, setEasyDirty] = useState(false)
  // Phase 3 Stage F follow-up — local node state so the user can drag
  // nodes around. Positions are persisted via "Save layout" which calls
  // survey.update with the new steps array (each step's `position`
  // mirrors the React Flow node position).
  const [nodes, setNodes] = useState<Node[]>([])
  const [layoutDirty, setLayoutDirty] = useState(false)

  const surveyQuery = trpc.survey.getById.useQuery(
    { id },
    { enabled: !!id },
  )

  const updateMutation = trpc.survey.update.useMutation({
    onSuccess: () => {
      toast.success('Customer journey saved')
      utils.survey.getById.invalidate({ id })
      utils.survey.list.invalidate()
      setDirty(false)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save')
    },
  })

  const survey = surveyQuery.data as
    | undefined
    | {
        id: string
        name: string
        slug: string
        template: 'quick' | 'deep' | 'adaptive' | 'custom'
        mode: 'intelligent' | 'builder'
        status: 'draft' | 'active' | 'archived'
        steps: Step[]
        settings: Record<string, unknown>
        legacyJourneyId: string | null
        legacyTruformId: string | null
      }

  // Sync local edit state from server state.
  useEffect(() => {
    if (survey) {
      setName(survey.name)
      setStatus(survey.status)

      // Phase 3 Stage F follow-up — flatten the step graph into the
      // friendly settings panel. We pick well-known step ids first
      // (the intelligent builders use stable ids) and fall back to
      // step-type heuristics so backfilled / hand-edited surveys also
      // populate sensibly.
      const steps = (survey.steps as Step[]) ?? []
      const stepsById = new Map(steps.map((s) => [s.id, s]))
      const firstAskMetric =
        stepsById.get('s1_metric') ??
        stepsById.get('s1_csat') ??
        stepsById.get('s1_nps') ??
        stepsById.get('s1_ces') ??
        steps.find((s) => s.type === 'ask_metric')
      const followupAsk =
        stepsById.get('s2_followup') ??
        steps.find(
          (s) =>
            s.type === 'ask_question' &&
            !Array.isArray((s.config as any).options),
        )
      const aspectAsk =
        stepsById.get('s3_unhappy') ??
        steps.find(
          (s) =>
            s.type === 'ask_question' &&
            Array.isArray((s.config as any).options),
        )
      const redirect = steps.find((s) => s.type === 'redirect')
      const endStep =
        stepsById.get('s4_thanks_yes') ??
        stepsById.get('s4_end') ??
        stepsById.get('s5_end') ??
        steps.find((s) => s.type === 'end_journey')

      const settings = (survey.settings ?? {}) as {
        reviewPlatform?: string
        branding?: { brandColor?: string }
      }

      setEasy({
        question:
          (firstAskMetric?.config as any)?.question ?? '',
        thankYouMessage: (endStep?.config as any)?.message ?? '',
        followupQuestion: (followupAsk?.config as any)?.question ?? '',
        reviewPlatform: settings.reviewPlatform ?? 'google',
        redirectUrl: (redirect?.config as any)?.url ?? '',
        reviewTemplate: (redirect?.config as any)?.reviewTemplate ?? '',
        aspectTagsCsv: Array.isArray((aspectAsk?.config as any)?.options)
          ? ((aspectAsk!.config as any).options as string[]).join(', ')
          : '',
        brandColor: settings.branding?.brandColor ?? '',
      })
      setEasyDirty(false)
    }
  }, [survey])

  const steps = (survey?.steps ?? []) as Step[]

  // Sync the React Flow node state from the server-side steps. Resetting
  // here also clears the layoutDirty flag because we're now in sync with
  // the persisted state.
  useEffect(() => {
    setNodes(
      buildNodes(steps, (step) => {
        setEditingStep(step)
        setStepDraft(JSON.parse(JSON.stringify(step.config)))
      }),
    )
    setLayoutDirty(false)
  }, [steps])

  const edges = useMemo<Edge[]>(() => buildEdges(steps), [steps])

  function onNodesChange(changes: NodeChange[]) {
    setNodes((current) => applyNodeChanges(changes, current))
    // Position changes are the only thing we want to flag as dirty.
    if (changes.some((c) => c.type === 'position')) setLayoutDirty(true)
  }

  function handleSaveLayout() {
    if (!survey) return
    // Pull the latest positions off the React Flow node state and
    // mirror them into each step's `position` field.
    const positionMap = new Map(
      nodes.map((n) => [n.id, n.position]),
    )
    const newSteps = steps.map((s) => {
      const pos = positionMap.get(s.id)
      return pos ? { ...s, position: { x: pos.x, y: pos.y } } : s
    })
    updateMutation.mutate({
      id: survey.id,
      steps: toWireSteps(newSteps),
    })
  }

  function handleSaveMetadata() {
    if (!survey) return
    updateMutation.mutate({
      id: survey.id,
      name,
      status,
    })
  }

  function handleSaveStep() {
    if (!survey || !editingStep) return
    const newSteps = steps.map((s) =>
      s.id === editingStep.id ? { ...s, config: stepDraft } : s,
    )
    updateMutation.mutate({
      id: survey.id,
      steps: toWireSteps(newSteps),
    })
    setEditingStep(null)
  }

  function patchDraft(key: string, value: unknown) {
    setStepDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // ─── Phase 3 Stage F follow-up — manual builder ─────────────────────
  //
  // Add / delete / connect operations on the step graph. Saved
  // immediately via survey.update(steps).

  /**
   * Generate a fresh step id of the form `step_<n>` not colliding with
   * any existing step.
   */
  function nextStepId(): string {
    const taken = new Set(steps.map((s) => s.id))
    let n = steps.length + 1
    while (taken.has(`step_${n}`)) n++
    return `step_${n}`
  }

  /**
   * Default config per step type. Mirrors what the intelligent builders
   * produce, minimised to the essentials so the user can fill in copy.
   */
  function defaultConfigFor(type: string): StepConfig {
    switch (type) {
      case 'ask_metric':
        return {
          metric: 'csat',
          question: 'How was your experience?',
          onComplete: { nextStepId: null },
        }
      case 'ask_question':
        return {
          fieldType: 'textarea',
          question: 'Tell us more',
          required: false,
          onComplete: { nextStepId: null },
        }
      case 'show_message':
        return {
          title: 'Heads up',
          body: 'Some helpful copy here.',
          nextStepId: null,
        }
      case 'collect_contact':
        return {
          fields: [
            { key: 'name', required: false },
            { key: 'email', required: false },
            { key: 'phone', required: false },
          ],
          privacyNote: '',
          nextStepId: null,
        }
      case 'redirect':
        return {
          platform: 'google',
          url: '',
          reviewTemplate: '',
          yesLabel: 'Sure',
          noLabel: 'Maybe later',
          onYesNextStepId: null,
          onNoNextStepId: null,
        }
      case 'branch_by_score':
        return {
          metricFromStepId: '',
          branches: [],
          defaultNextStepId: null,
        }
      case 'branch_by_answer':
        // Field is `answerFromStepId` per branchByAnswerStepSchema (was
        // a typo `fromStepId` here, which silently dropped + tripped a
        // "required" validator error every time a Route by Answer was
        // added). null = "not yet wired", validator accepts it.
        return {
          answerFromStepId: null,
          branches: [],
          defaultNextStepId: null,
        }
      case 'end_journey':
        return { message: 'Thank you!' }
      default:
        return {}
    }
  }

  /**
   * Add a new step to the graph at a position not overlapping existing
   * nodes. Save immediately so the user sees it land on the canvas.
   */
  function handleAddStep(type: string) {
    if (!survey) return
    const id = nextStepId()
    const occupied = steps.map((s) => s.position ?? { x: 0, y: 0 })
    // Drop the new step below the lowest existing node.
    const maxY = occupied.length
      ? Math.max(...occupied.map((p) => p.y))
      : 0
    const newStep: Step = {
      id,
      type,
      position: { x: 0, y: maxY + 200 },
      config: defaultConfigFor(type),
    }
    updateMutation.mutate({
      id: survey.id,
      steps: toWireSteps([...steps, newStep]),
    })
  }

  /**
   * Remove a step. Also clear any pointers that were aiming at it (so
   * the saved graph stays consistent — pointers become null, surfacing
   * as red dashed dead-ends until the user re-routes them).
   */
  function handleDeleteStep(stepId: string) {
    if (!survey) return
    const remaining = steps.filter((s) => s.id !== stepId)
    const cleaned = remaining.map((s) => clearPointersTo(s, stepId))
    updateMutation.mutate({
      id: survey.id,
      steps: toWireSteps(cleaned),
    })
    setEditingStep(null)
  }

  // Drag-edge handler — wires the source step's "next" pointer to the
  // target. For ask_metric, ask_question, show_message, collect_contact
  // we set the obvious single next pointer. branch_by_score,
  // branch_by_answer, redirect, end_journey have multiple (or zero)
  // outgoing pointers and need explicit routing — for those we open the
  // source step in the editor so the user can pick.
  function handleConnect(c: Connection) {
    if (!survey || !c.source || !c.target) return
    const sourceStep = steps.find((s) => s.id === c.source)
    if (!sourceStep) return
    const newConfig = setNextPointer(sourceStep, c.target)
    if (!newConfig) {
      toast.message(
        'This step has multiple outgoing routes — open it to pick which one.',
      )
      const fresh = steps.find((s) => s.id === c.source)
      if (fresh) {
        setEditingStep(fresh)
        setStepDraft(JSON.parse(JSON.stringify(fresh.config)))
      }
      return
    }
    const newSteps = steps.map((s) =>
      s.id === sourceStep.id ? { ...s, config: newConfig } : s,
    )
    updateMutation.mutate({ id: survey.id, steps: toWireSteps(newSteps) })
  }

  if (surveyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
        <h3 className="text-lg font-semibold">Customer journey not found</h3>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/journeys">Back to customer journeys</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/journeys" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{survey.name}</h1>
            <p className="text-xs text-muted-foreground">
              {/* Hotfix-2 — every non-deep template (quick / adaptive /
                  custom) uses the /j/{slug} URL space. Deep is the only
                  one that uses /f/. Was hardcoded to 'quick' check,
                  which threw adaptive + custom into /f/ — a fresh-from-
                  wizard custom journey would show "/f/j-..." in the
                  header (visible bug from the smoke test). */}
              /{survey.template === 'deep' ? 'f' : 'j'}/{survey.slug}{' '}
              <Badge
                variant="outline"
                className={
                  survey.template === 'deep'
                    ? 'ml-2 text-purple-700 border-purple-300 bg-purple-50'
                    : 'ml-2 text-blue-700 border-blue-300 bg-blue-50'
                }
              >
                {survey.template}
              </Badge>
              <Badge variant="outline" className="ml-1">
                {survey.mode}
              </Badge>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQrOpen(true)}
            title="Show QR code"
          >
            <QrCode className="size-3.5" />
            QR code
          </Button>
          {survey.status === 'active' && (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/${survey.template === 'deep' ? 'f' : 'j'}/${survey.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-3.5" />
                Open public URL
              </a>
            </Button>
          )}
        </div>
      </div>

      {/*
        Hotfix PRD §6 — wrap the editor in a Tabs container so a
        "Responses" tab can sit alongside the builder.
      */}
      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">

      {/*
        Hotfix §2 — adaptive surveys get a flat settings form instead of
        the React Flow canvas. Step graph stays in the DB as rollback
        insurance but is not editable in this view (owner switches by
        flipping template back to 'quick' if needed — see
        docs/HOTFIX_§2_ROLLBACK.md).
      */}
      {survey.template === 'adaptive' ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Journey settings</CardTitle>
              <CardDescription className="text-xs">
                Renaming and status changes apply immediately. Adaptive
                journey config is edited below.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="survey-name-adaptive">Name</Label>
                <Input
                  id="survey-name-adaptive"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setDirty(true)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as typeof status)
                    setDirty(true)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={handleSaveMetadata}
                  disabled={!dirty || updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <AdaptiveSettingsForm
            surveyId={survey.id}
            template="adaptive"
            initialSettings={survey.settings ?? {}}
          />
        </>
      ) : survey.template === 'custom' ? (
        // Hotfix PRD §3.4 — decision-tree editor for custom journeys.
        // Replaces the React Flow canvas with a pre-rendered tree of
        // clickable boxes + per-step content panel + "+Insert step here"
        // buttons on the negative chain. The wizard's structure
        // (rating → branch → positive/negative paths → terminal) is
        // wizard-locked; only content edits + chain insertions are
        // allowed here.
        <DecisionTreeEditor
          surveyId={survey.id}
          initialSteps={survey.steps as unknown as SurveyStep[]}
          workspaceId={currentWorkspaceId ?? ''}
          slug={survey.slug}
        />
      ) : (
        <>

      {/* Metadata editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Journey settings</CardTitle>
          <CardDescription className="text-xs">
            Renaming and status changes apply immediately. Step-graph edits
            are saved per-step from the canvas below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="survey-name">Name</Label>
            <Input
              id="survey-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setDirty(true)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status)
                setDirty(true)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={handleSaveMetadata}
              disabled={!dirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* React Flow canvas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Step graph</CardTitle>
              <CardDescription className="text-xs">
                <strong>Add</strong> a step from the palette below.{' '}
                <strong>Drag</strong> to re-arrange.{' '}
                <strong>Click</strong> a step to edit / delete it.{' '}
                <strong>Drag a handle</strong> from one step to another
                to wire them up. Red dashed edges point at missing steps.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant={layoutDirty ? 'default' : 'outline'}
              onClick={handleSaveLayout}
              disabled={!layoutDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save layout
            </Button>
          </div>
        </CardHeader>

        {/*
          Phase 3 Stage F follow-up — palette of step types.
          Click a chip to add a new step. The new step is appended to
          the canvas (positioned below the lowest existing node) and
          saved immediately.
        */}
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2.5 text-xs">
          <span className="font-medium text-muted-foreground">Add step:</span>
          {STEP_TYPES_FOR_PALETTE.map((type) => {
            const meta = STEP_TYPE_LABELS[type]
            return (
              <Button
                key={type}
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => handleAddStep(type)}
                disabled={updateMutation.isPending}
                title={meta.description}
              >
                <Plus className="size-3" />
                {meta.label}
              </Button>
            )
          })}
        </div>

        <CardContent className="p-0">
          <div className="h-[600px] w-full border-t bg-muted/10">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onConnect={handleConnect}
              fitView
              nodesDraggable={true}
              nodesConnectable={true}
              elementsSelectable={true}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} color="#e5e7eb" />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

        </>
      )}

        </TabsContent>

        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Responses</CardTitle>
              <CardDescription className="text-xs">
                Every customer who completed this journey. Click a row for
                full detail. Search hits the customer name, email, and phone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsesList surveyId={survey.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Step editor sheet */}
      <Sheet
        open={!!editingStep}
        onOpenChange={(open) => {
          if (!open) setEditingStep(null)
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              Edit{' '}
              {editingStep
                ? getStepTypeLabel(editingStep.type).label
                : 'step'}
              {editingStep && (
                <code className="ml-2 rounded bg-muted px-1 text-xs font-normal">
                  {editingStep.id}
                </code>
              )}
            </SheetTitle>
            <SheetDescription>
              {editingStep
                ? getStepTypeLabel(editingStep.type).description
                : ''}
            </SheetDescription>
          </SheetHeader>

          {editingStep && (
            <div className="space-y-4 px-4 py-2">
              {/* Render fields per step type. Anything more exotic falls
                  through to a raw JSON editor. */}
              {(editingStep.type === 'ask_metric' ||
                editingStep.type === 'ask_question') && (
                <div className="space-y-1.5">
                  <Label>Question text</Label>
                  <Textarea
                    rows={2}
                    value={String(stepDraft.question ?? '')}
                    onChange={(e) =>
                      patchDraft('question', e.target.value)
                    }
                  />
                </div>
              )}

              {editingStep.type === 'show_message' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={String(stepDraft.title ?? '')}
                      onChange={(e) => patchDraft('title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body</Label>
                    <Textarea
                      rows={3}
                      value={String(stepDraft.body ?? '')}
                      onChange={(e) => patchDraft('body', e.target.value)}
                    />
                  </div>
                </>
              )}

              {editingStep.type === 'redirect' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Review template (copied to clipboard)</Label>
                    <Textarea
                      rows={3}
                      value={String(stepDraft.reviewTemplate ?? '')}
                      onChange={(e) =>
                        patchDraft('reviewTemplate', e.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Yes label</Label>
                      <Input
                        value={String(stepDraft.yesLabel ?? '')}
                        onChange={(e) =>
                          patchDraft('yesLabel', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>No label</Label>
                      <Input
                        value={String(stepDraft.noLabel ?? '')}
                        onChange={(e) =>
                          patchDraft('noLabel', e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Redirect URL</Label>
                    <Input
                      value={String(stepDraft.url ?? '')}
                      onChange={(e) => patchDraft('url', e.target.value)}
                      placeholder="https://g.page/r/..."
                    />
                  </div>
                </>
              )}

              {editingStep.type === 'end_journey' && (
                <div className="space-y-1.5">
                  <Label>Thank-you message</Label>
                  <Textarea
                    rows={3}
                    value={String(stepDraft.message ?? '')}
                    onChange={(e) => patchDraft('message', e.target.value)}
                  />
                </div>
              )}

              {/* Branch + collect_contact: surface the next-step pointers
                  read-only (re-routing edges is part of the deferred
                  full builder mode). */}
              {(editingStep.type === 'branch_by_score' ||
                editingStep.type === 'branch_by_answer') && (
                <div className="space-y-1.5">
                  <Label>Branches (read-only)</Label>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(
                      {
                        branches: stepDraft.branches,
                        defaultNextStepId: stepDraft.defaultNextStepId,
                      },
                      null,
                      2,
                    )}
                  </pre>
                  <p className="text-[11px] text-muted-foreground">
                    Branch graph editing is part of the full builder mode
                    (deferred). For now intelligent-mode surveys ship with
                    sensible defaults derived from settings.
                  </p>
                </div>
              )}

              {editingStep.type === 'collect_contact' && (
                <div className="space-y-1.5">
                  <Label>Privacy note</Label>
                  <Input
                    value={String(stepDraft.privacyNote ?? '')}
                    onChange={(e) =>
                      patchDraft('privacyNote', e.target.value)
                    }
                  />
                </div>
              )}

              {/* Raw JSON fallback — always available. */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Raw config JSON
                </summary>
                <pre className="mt-2 max-h-[200px] overflow-auto rounded-md bg-muted p-3">
                  {JSON.stringify(stepDraft, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <SheetFooter className="px-4 sm:flex-col sm:items-stretch sm:gap-2">
            <div className="flex w-full items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingStep(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveStep}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save step
              </Button>
            </div>
            {/* Phase 3 Stage F follow-up — delete this step.
                Sits below the save row so it's not the primary action. */}
            <Button
              variant="ghost"
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (!editingStep) return
                if (
                  window.confirm(
                    `Delete step "${editingStep.id}"? Pointers from other steps that aimed at this one will become red dashed dead-ends.`,
                  )
                ) {
                  handleDeleteStep(editingStep.id)
                }
              }}
              disabled={updateMutation.isPending}
            >
              <Trash2 className="size-4" />
              Delete step
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* QR code dialog — restored from the deleted journeys page. */}
      <SurveyQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        survey={survey}
        currentWorkspaceId={currentWorkspaceId}
      />
    </div>
  )
}

function SurveyQrDialog({
  open,
  onOpenChange,
  survey,
  currentWorkspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  survey:
    | {
        id: string
        name: string
        slug: string
        template: 'quick' | 'deep'
      }
    | undefined
  currentWorkspaceId: string | null
}) {
  const qrQuery = trpc.qr.generateJourneyQr.useQuery(
    {
      journeyId: survey?.id ?? '',
      workspaceId: currentWorkspaceId ?? undefined,
      size: 300,
      format: 'png',
    },
    {
      // Hotfix-2 — every non-deep template (quick / adaptive / custom)
      // shares the journey QR generator since they all use /j/{slug}
      // URLs. Was 'quick' only — adaptive + custom hit no QR path and
      // showed "No QR available" in the dialog.
      enabled:
        open &&
        !!survey &&
        survey.template !== 'deep' &&
        !!currentWorkspaceId,
    },
  )

  const formQrMutation = trpc.qr.generateFormQr.useMutation()
  const [deepUrl, setDeepUrl] = useState<string | null>(null)
  const [deepLoading, setDeepLoading] = useState(false)

  useEffect(() => {
    if (
      !open ||
      !survey ||
      survey.template !== 'deep' ||
      !currentWorkspaceId
    ) {
      return
    }
    setDeepLoading(true)
    formQrMutation.mutate(
      {
        formId: survey.id,
        workspaceId: currentWorkspaceId,
        size: 300,
        format: 'png',
      },
      {
        onSuccess: (data: any) => {
          setDeepUrl(typeof data === 'string' ? data : data?.qrDataUrl ?? null)
          setDeepLoading(false)
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to generate QR')
          setDeepLoading(false)
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, survey?.id])

  // Hotfix-2 — quick / adaptive / custom share the journey QR path;
  // only deep uses the form QR mutation. Single derived flag instead
  // of three template-equality checks (was 'quick' === so adaptive +
  // custom fell through to the deep branch and showed empty data).
  const isJourneyTemplate = !!survey && survey.template !== 'deep'
  const dataUrl = isJourneyTemplate ? qrQuery.data?.qrDataUrl : deepUrl
  const isLoading = isJourneyTemplate ? qrQuery.isLoading : deepLoading
  const publicUrl = survey
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${
        isJourneyTemplate ? 'j' : 'f'
      }/${survey.slug}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR code for {survey?.name}</DialogTitle>
          <DialogDescription>
            Scanning opens{' '}
            <code className="rounded bg-muted px-1 text-xs">{publicUrl}</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-3">
          {isLoading ? (
            <Skeleton className="h-[280px] w-[280px] rounded-md" />
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`QR code for ${survey?.name}`}
              className="rounded-md border"
              width={280}
              height={280}
            />
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              No QR available.
            </div>
          )}
        </div>
        <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
          <div className="flex w-full items-center gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (publicUrl) {
                  navigator.clipboard
                    .writeText(publicUrl)
                    .then(() => toast.success('Public URL copied'))
                    .catch(() => toast.error('Failed to copy'))
                }
              }}
            >
              <Copy className="size-4" />
              Copy URL
            </Button>
            <Button
              className="flex-1"
              disabled={!dataUrl}
              onClick={() => {
                if (!dataUrl || !survey) return
                const link = document.createElement('a')
                link.href = dataUrl
                link.download = `${survey.slug}-qr.png`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
            >
              <Download className="size-4" />
              Download PNG
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
