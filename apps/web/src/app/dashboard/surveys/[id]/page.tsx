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
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
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

const STEP_KIND_META: Record<
  string,
  { label: string; color: string; icon: typeof Sparkles }
> = {
  ask_metric: {
    label: 'Ask metric',
    color: 'border-blue-400 bg-blue-50',
    icon: Sparkles,
  },
  ask_question: {
    label: 'Ask question',
    color: 'border-violet-400 bg-violet-50',
    icon: HelpCircle,
  },
  branch_by_score: {
    label: 'Branch by score',
    color: 'border-amber-400 bg-amber-50',
    icon: GitBranch,
  },
  branch_by_answer: {
    label: 'Branch by answer',
    color: 'border-amber-400 bg-amber-50',
    icon: GitBranch,
  },
  show_message: {
    label: 'Show message',
    color: 'border-slate-300 bg-slate-50',
    icon: MessageSquare,
  },
  collect_contact: {
    label: 'Collect contact',
    color: 'border-emerald-300 bg-emerald-50',
    icon: UserPlus,
  },
  redirect: {
    label: 'Redirect',
    color: 'border-cyan-300 bg-cyan-50',
    icon: RedirectIcon,
  },
  end_journey: {
    label: 'End',
    color: 'border-rose-300 bg-rose-50',
    icon: Flag,
  },
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
    const meta = STEP_KIND_META[s.type] ?? {
      label: s.type,
      color: 'border-slate-300 bg-slate-50',
      icon: Info,
    }
    const Icon = meta.icon
    return {
      id: s.id,
      type: 'default',
      position: s.position ?? { x: (i % 3) * 240, y: Math.floor(i / 3) * 180 },
      data: {
        label: (
          <div
            className={`min-w-[160px] cursor-pointer rounded-lg border-2 px-3 py-2 text-left shadow-sm ${meta.color}`}
            onClick={() => onPick(s)}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3" />
              {meta.label}
            </div>
            <div className="mt-1 truncate text-sm font-medium">{s.id}</div>
          </div>
        ) as unknown as string,
      },
      style: { background: 'transparent', border: 'none', padding: 0 },
    }
  })
}

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
      toast.success('Survey saved')
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
        template: 'quick' | 'deep'
        mode: 'intelligent' | 'builder'
        status: 'draft' | 'active' | 'archived'
        steps: Step[]
        legacyJourneyId: string | null
        legacyTruformId: string | null
      }

  // Sync local edit state from server state.
  useEffect(() => {
    if (survey) {
      setName(survey.name)
      setStatus(survey.status)
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
      steps: newSteps,
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
      steps: newSteps,
    })
    setEditingStep(null)
  }

  function patchDraft(key: string, value: unknown) {
    setStepDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
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
        <h3 className="text-lg font-semibold">Survey not found</h3>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/surveys">Back to surveys</Link>
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
            <Link href="/dashboard/surveys" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{survey.name}</h1>
            <p className="text-xs text-muted-foreground">
              /{survey.template === 'quick' ? 'j' : 'f'}/{survey.slug}{' '}
              <Badge
                variant="outline"
                className={
                  survey.template === 'quick'
                    ? 'ml-2 text-blue-700 border-blue-300 bg-blue-50'
                    : 'ml-2 text-purple-700 border-purple-300 bg-purple-50'
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
          {survey.status === 'active' && (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/${survey.template === 'quick' ? 'j' : 'f'}/${survey.slug}`}
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

      {/* Metadata editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Survey settings</CardTitle>
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
                Drag a step to re-arrange. Click any step to edit its
                config. Dashed red edges point at steps that don't exist
                (typo in a config).
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
        <CardContent className="p-0">
          <div className="h-[600px] w-full border-t bg-muted/10">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              fitView
              nodesDraggable={true}
              nodesConnectable={false}
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
              Edit step{' '}
              <code className="rounded bg-muted px-1 text-xs">
                {editingStep?.id}
              </code>
            </SheetTitle>
            <SheetDescription>
              Type:{' '}
              <code className="rounded bg-muted px-1 text-xs">
                {editingStep?.type}
              </code>
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

          <SheetFooter className="px-4">
            <Button
              variant="outline"
              onClick={() => setEditingStep(null)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveStep}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Save step
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
