'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Copy,
  Save,
  Star,
  ExternalLink,
  BarChart3,
  ClipboardList,
  QrCode,
  Download,
  Eye,
  Play,
  Archive,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  Share2,
  X,
  List,
  Type,
  AlignLeft,
  ThumbsUp,
  GitBranch,
  Circle,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomQuestion {
  id: string
  type: 'rating' | 'text' | 'textarea' | 'select' | 'multi_select' | 'yes_no'
  label: string
  required: boolean
  options?: string[]
  order: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const typeColors: Record<string, string> = {
  nps: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  csat: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ces: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  archived: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-[667px] w-full rounded-[40px]" />
        </div>
      </div>
    </div>
  )
}

// ─── Phone Preview ───────────────────────────────────────────────────────────

function FormPhonePreview({
  form,
  brandColor,
  thankYouMessage,
  customQuestions,
}: {
  form: any
  brandColor: string
  thankYouMessage: string
  customQuestions: CustomQuestion[]
}) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 p-6 overflow-y-auto">
      {/* Brand accent */}
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: brandColor }} />

      {/* Form title */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {form.name || 'Feedback Form'}
      </h2>
      {form.config?.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{form.config.description}</p>
      )}

      {/* Type-specific preview */}
      <div className="flex-1 space-y-6 mt-2">
        {form.type === 'nps' && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                How likely are you to recommend us to a friend or colleague?
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex size-7 items-center justify-center rounded text-[10px] font-medium ${
                      i <= 6
                        ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                        : i <= 8
                          ? 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
                          : 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                    }`}
                  >
                    {i}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-gray-400">
                <span>Not at all likely</span>
                <span>Extremely likely</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">What could we do better?</p>
              <div className="h-16 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400">
                Your feedback...
              </div>
            </div>
          </>
        )}

        {form.type === 'csat' && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                How satisfied are you with our service?
              </p>
              <div className="flex justify-center gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-7 text-gray-300 dark:text-gray-600" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Any additional feedback?</p>
              <div className="h-16 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400">
                Your feedback...
              </div>
            </div>
          </>
        )}

        {form.type === 'ces' && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                How easy was it to get what you needed today?
              </p>
              <div className="flex flex-wrap gap-1 justify-center">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex size-9 items-center justify-center rounded-lg border text-sm font-medium"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-gray-400">
                <span>Very Difficult</span>
                <span>Very Easy</span>
              </div>
            </div>
          </>
        )}

        {form.type === 'custom' && (
          <div className="space-y-4">
            {customQuestions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">
                No questions added yet
              </p>
            ) : (
              customQuestions.map((q, i) => (
                <div key={q.id} className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {q.label || `Question ${i + 1}`}
                    {q.required && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                  {q.type === 'rating' && (
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="size-5 text-gray-300 dark:text-gray-600" />
                      ))}
                    </div>
                  )}
                  {q.type === 'text' && (
                    <div className="h-8 rounded border bg-gray-50 dark:bg-gray-900 p-1.5 text-[10px] text-gray-400">
                      Short answer...
                    </div>
                  )}
                  {q.type === 'textarea' && (
                    <div className="h-14 rounded border bg-gray-50 dark:bg-gray-900 p-1.5 text-[10px] text-gray-400">
                      Long answer...
                    </div>
                  )}
                  {q.type === 'select' && (
                    <div className="h-8 rounded border bg-gray-50 dark:bg-gray-900 p-1.5 text-[10px] text-gray-400 flex items-center justify-between">
                      <span>Select an option</span>
                      <ChevronDown className="size-3" />
                    </div>
                  )}
                  {q.type === 'multi_select' && (
                    <div className="space-y-1">
                      {(q.options ?? ['Option 1', 'Option 2']).slice(0, 3).map((opt, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <div className="size-3 rounded border" />
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'yes_no' && (
                    <div className="flex gap-2">
                      <div className="flex-1 rounded border py-1.5 text-center text-[10px] font-medium text-gray-600">
                        Yes
                      </div>
                      <div className="flex-1 rounded border py-1.5 text-center text-[10px] font-medium text-gray-600">
                        No
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Contact fields */}
        <div className="space-y-2 pt-2">
          <div className="h-8 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400">
            Your name (optional)
          </div>
          <div className="h-8 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400">
            Your email (optional)
          </div>
        </div>
      </div>

      <button
        className="mt-4 w-full rounded-lg py-2.5 text-sm font-medium text-white"
        style={{ backgroundColor: brandColor }}
      >
        Submit Feedback
      </button>
    </div>
  )
}

// ─── Score Distribution Chart ────────────────────────────────────────────────

function DistributionChart({
  distribution,
}: {
  distribution: Record<string, number>
}) {
  const entries = Object.entries(distribution).sort(
    ([a], [b]) => Number(a) - Number(b)
  )
  const maxVal = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="space-y-2">
      {entries.map(([score, count]) => (
        <div key={score} className="flex items-center gap-3 text-sm">
          <span className="w-6 text-right font-medium">{score}</span>
          <div className="flex-1 bg-muted rounded-full overflow-hidden h-6">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{ width: `${(count / maxVal) * 100}%`, minWidth: count > 0 ? '4px' : '0' }}
            />
          </div>
          <span className="w-10 text-right text-xs text-muted-foreground">
            {count}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── NPS Breakdown Bar ───────────────────────────────────────────────────────

function NpsBreakdownBar({
  promoters,
  passives,
  detractors,
}: {
  promoters: number
  passives: number
  detractors: number
}) {
  const total = promoters + passives + detractors
  if (total === 0) return null

  const pPct = (promoters / total) * 100
  const paPct = (passives / total) * 100
  const dPct = (detractors / total) * 100

  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full overflow-hidden rounded-full">
        {dPct > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center text-xs font-medium text-white transition-all"
            style={{ width: `${dPct}%` }}
          >
            {dPct >= 10 && `${Math.round(dPct)}%`}
          </div>
        )}
        {paPct > 0 && (
          <div
            className="bg-amber-400 flex items-center justify-center text-xs font-medium text-white transition-all"
            style={{ width: `${paPct}%` }}
          >
            {paPct >= 10 && `${Math.round(paPct)}%`}
          </div>
        )}
        {pPct > 0 && (
          <div
            className="bg-green-500 flex items-center justify-center text-xs font-medium text-white transition-all"
            style={{ width: `${pPct}%` }}
          >
            {pPct >= 10 && `${Math.round(pPct)}%`}
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-500" />
          <span>Detractors ({detractors})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-amber-400" />
          <span>Passives ({passives})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-green-500" />
          <span>Promoters ({promoters})</span>
        </div>
      </div>
    </div>
  )
}

// ─── Simple Trend Line ───────────────────────────────────────────────────────

function SimpleTrendChart({
  data,
  color = '#6366f1',
}: {
  data: { label: string; value: number }[]
  color?: string
}) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const height = 120
  const width = 100

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1 min-w-fit" style={{ height: height + 24 }}>
        {data.map((d, i) => {
          const barHeight = Math.max((d.value / maxVal) * height, 2)
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[24px]">
              <span className="text-[9px] text-muted-foreground">{d.value}</span>
              <div
                className="w-full max-w-[24px] rounded-t transition-all duration-500"
                style={{ height: barHeight, backgroundColor: color }}
              />
              <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Custom Question Builder ─────────────────────────────────────────────────

function CustomQuestionBuilder({
  questions,
  onChange,
}: {
  questions: CustomQuestion[]
  onChange: (questions: CustomQuestion[]) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function addQuestion(type: CustomQuestion['type']) {
    const newQ: CustomQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: '',
      required: false,
      options: type === 'select' || type === 'multi_select' ? ['Option 1', 'Option 2'] : undefined,
      order: questions.length,
    }
    onChange([...questions, newQ])
  }

  function updateQuestion(index: number, updates: Partial<CustomQuestion>) {
    const next = [...questions]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })))
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    const next = [...questions]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= next.length) return
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    onChange(next.map((q, i) => ({ ...q, order: i })))
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...questions]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    onChange(next.map((q, i) => ({ ...q, order: i })))
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const questionTypes = [
    { value: 'rating' as const, label: 'Rating (1-5)' },
    { value: 'text' as const, label: 'Short Text' },
    { value: 'textarea' as const, label: 'Long Text' },
    { value: 'select' as const, label: 'Single Select' },
    { value: 'multi_select' as const, label: 'Multi Select' },
    { value: 'yes_no' as const, label: 'Yes / No' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Questions ({questions.length})</Label>
        <Select onValueChange={(v) => addQuestion(v as CustomQuestion['type'])}>
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <Plus className="size-3.5" />
              <SelectValue placeholder="Add question..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            {questionTypes.map((qt) => (
              <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-10">
          <p className="text-sm text-muted-foreground">
            No questions yet. Add your first question above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, index) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              onDrop={(e) => handleDrop(e, index)}
              className={`rounded-lg border p-3 transition-all ${
                dragIndex === index
                  ? 'opacity-50 border-dashed'
                  : dragOverIndex === index
                    ? 'border-primary bg-primary/5'
                    : 'bg-card'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground">
                  <GripVertical className="size-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {questionTypes.find((qt) => qt.value === q.type)?.label ?? q.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  </div>
                  <Input
                    value={q.label}
                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                    placeholder="Question text..."
                    className="text-sm"
                  />
                  {(q.type === 'select' || q.type === 'multi_select') && (
                    <div className="space-y-1.5 pl-2">
                      <Label className="text-xs">Options (one per line)</Label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={(q.options ?? []).join('\n')}
                        onChange={(e) =>
                          updateQuestion(index, {
                            options: e.target.value.split('\n').filter(Boolean),
                          })
                        }
                        placeholder={'Option 1\nOption 2\nOption 3'}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={q.required}
                        onCheckedChange={(checked) => updateQuestion(index, { required: checked })}
                      />
                      <span className="text-xs text-muted-foreground">Required</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, 'up')}
                  >
                    <ChevronUp className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 'down')}
                  >
                    <ChevronDown className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    onClick={() => removeQuestion(index)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Responses Tab ───────────────────────────────────────────────────────────

function ResponsesTab({ formId }: { formId: string }) {
  const [page, setPage] = useState(1)
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null)

  const responsesQuery = trpc.truform.listResponses.useQuery(
    { truformId: formId, page, limit: 20 },
    { enabled: !!formId }
  )

  const responses = responsesQuery.data?.data ?? []
  const totalPages = responsesQuery.data?.totalPages ?? 0
  const total = responsesQuery.data?.total ?? 0

  function exportCsv() {
    if (responses.length === 0) return
    const headers = ['Date', 'Customer', 'Score', 'Feedback']
    const rows = responses.map((r: any) => [
      new Date(r.createdAt).toLocaleDateString(),
      r.customerName ?? r.customerEmail ?? 'Anonymous',
      r.score ?? '',
      (r.feedback ?? '').replace(/"/g, '""'),
    ])
    const csv = [headers, ...rows].map((row) => row.map((c: any) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.download = `truform-responses-${formId}.csv`
    link.href = URL.createObjectURL(blob)
    link.click()
    toast.success('Responses exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} response{total !== 1 ? 's' : ''} total
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={responses.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {responsesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : responses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No responses yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((response: any) => (
                  <TableRow
                    key={response.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedResponse(response)}
                  >
                    <TableCell className="text-xs">
                      {new Date(response.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {response.customerName ?? response.customerEmail ?? 'Anonymous'}
                    </TableCell>
                    <TableCell>
                      {response.score != null ? (
                        <div className="flex items-center gap-1">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium">{response.score}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate">
                        {response.feedback ?? response.answers
                          ? JSON.stringify(response.answers).slice(0, 60) + '...'
                          : '--'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Response detail sheet */}
      <Sheet
        open={!!selectedResponse}
        onOpenChange={(open) => { if (!open) setSelectedResponse(null) }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedResponse && (
            <>
              <SheetHeader>
                <SheetTitle>Response Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  {selectedResponse.score != null && (
                    <div className="flex items-center gap-1.5">
                      <Star className="size-5 fill-amber-400 text-amber-400" />
                      <span className="text-xl font-bold">{selectedResponse.score}</span>
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {new Date(selectedResponse.createdAt).toLocaleString()}
                  </span>
                </div>

                {(selectedResponse.customerName || selectedResponse.customerEmail) && (
                  <div className="space-y-1">
                    {selectedResponse.customerName && (
                      <p className="text-sm font-medium">{selectedResponse.customerName}</p>
                    )}
                    {selectedResponse.customerEmail && (
                      <p className="text-xs text-muted-foreground">{selectedResponse.customerEmail}</p>
                    )}
                    {selectedResponse.customerPhone && (
                      <p className="text-xs text-muted-foreground">{selectedResponse.customerPhone}</p>
                    )}
                  </div>
                )}

                <Separator />

                {selectedResponse.feedback && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Feedback</Label>
                    <p className="text-sm">{selectedResponse.feedback}</p>
                  </div>
                )}

                {selectedResponse.answers && typeof selectedResponse.answers === 'object' && (
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Answers</Label>
                    {Object.entries(selectedResponse.answers).map(([key, value]: [string, any]) => (
                      <div key={key} className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">{key}</p>
                        <p className="text-sm">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────

function AnalyticsTab({ formId, formType }: { formId: string; formType: string }) {
  const statsQuery = trpc.truform.getStats.useQuery(
    { truformId: formId },
    { enabled: !!formId }
  )

  const stats = statsQuery.data

  if (statsQuery.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-4 w-24" />
          </Card>
        ))}
      </div>
    )
  }

  if (!stats || (stats.totalResponses ?? 0) === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 className="size-10 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">No analytics data yet. Collect some responses first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.totalResponses ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Responses</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Star className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-3xl font-bold">
                {stats.averageScore != null
                  ? Number(stats.averageScore).toFixed(1)
                  : '--'}
              </p>
              <p className="text-sm text-muted-foreground">Average Score</p>
            </div>
          </div>
        </Card>
        {formType === 'nps' && stats.npsScore != null && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-lg ${
                Number(stats.npsScore) >= 50 ? 'bg-green-500/10' : Number(stats.npsScore) >= 0 ? 'bg-amber-500/10' : 'bg-red-500/10'
              }`}>
                {Number(stats.npsScore) >= 0 ? (
                  <TrendingUp className={`size-5 ${Number(stats.npsScore) >= 50 ? 'text-green-500' : 'text-amber-500'}`} />
                ) : (
                  <TrendingDown className="size-5 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.npsScore}</p>
                <p className="text-sm text-muted-foreground">NPS Score</p>
              </div>
            </div>
          </Card>
        )}
        {formType === 'csat' && stats.csatPercentage != null && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <CheckCircle2 className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.csatPercentage}%</p>
                <p className="text-sm text-muted-foreground">CSAT %</p>
              </div>
            </div>
          </Card>
        )}
        {formType === 'ces' && stats.cesAverage != null && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
                <BarChart3 className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {Number(stats.cesAverage).toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">CES Average</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* NPS Breakdown */}
      {formType === 'nps' && stats.npsBreakdown && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold">NPS Breakdown</h3>
          <NpsBreakdownBar
            promoters={(stats.npsBreakdown as any).promoters ?? 0}
            passives={(stats.npsBreakdown as any).passives ?? 0}
            detractors={(stats.npsBreakdown as any).detractors ?? 0}
          />
        </Card>
      )}

      {/* Distribution */}
      {stats.distribution && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Score Distribution</h3>
          <DistributionChart
            distribution={stats.distribution as Record<string, number>}
          />
        </Card>
      )}

      {/* Score Trend */}
      {stats.trend && Array.isArray(stats.trend) && stats.trend.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Score Trend</h3>
          <SimpleTrendChart
            data={(stats.trend as any[]).map((t: any) => ({
              label: t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
              value: t.averageScore ?? t.count ?? 0,
            }))}
          />
        </Card>
      )}

      {/* Response Rate */}
      {stats.responseRate && Array.isArray(stats.responseRate) && stats.responseRate.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Response Rate Over Time</h3>
          <SimpleTrendChart
            data={(stats.responseRate as any[]).map((r: any) => ({
              label: r.date ? new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
              value: r.count ?? 0,
            }))}
            color="#22c55e"
          />
        </Card>
      )}
    </div>
  )
}

// ─── QR Dialog ───────────────────────────────────────────────────────────────

function QrCodeDialog({
  open,
  onOpenChange,
  formSlug,
  formId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formSlug: string
  formId: string
}) {
  const [qrSize, setQrSize] = useState('256')
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/f/${formSlug}`
    : `/f/${formSlug}`

  const qrQuery = trpc.qr.generateFormQr.useQuery(
    { truformId: formId, size: parseInt(qrSize) },
    { enabled: open && !!formId }
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Share this QR code to collect feedback.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrQuery.isLoading ? (
            <Skeleton className="size-64 rounded-lg" />
          ) : qrQuery.data?.qrDataUrl ? (
            <img
              src={qrQuery.data.qrDataUrl}
              alt="QR Code"
              className="rounded-lg border"
              style={{ width: parseInt(qrSize), height: parseInt(qrSize) }}
            />
          ) : (
            <div className="flex size-64 items-center justify-center rounded-lg border bg-muted">
              <QrCode className="size-16 text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Size:</Label>
            <Select value={qrSize} onValueChange={setQrSize}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="128">128px</SelectItem>
                <SelectItem value="256">256px</SelectItem>
                <SelectItem value="512">512px</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-center gap-2">
            <Input value={publicUrl} readOnly className="flex-1 text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl)
                toast.success('Link copied')
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl)
              toast.success('Link copied')
            }}
          >
            <Copy className="size-4" />
            Copy Link
          </Button>
          <Button
            onClick={() => {
              if (!qrQuery.data?.qrDataUrl) return
              const link = document.createElement('a')
              link.download = `form-${formSlug}-qr.png`
              link.href = qrQuery.data.qrDataUrl
              link.click()
              toast.success('QR code downloaded')
            }}
            disabled={!qrQuery.data?.qrDataUrl}
          >
            <Download className="size-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Visual Flow Builder ─────────────────────────────────────────────────────

const questionTypeConfig: Record<
  string,
  { icon: typeof Star; color: string; bgColor: string; borderColor: string; label: string }
> = {
  rating: {
    icon: Star,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Rating',
  },
  text: {
    icon: Type,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Short Text',
  },
  textarea: {
    icon: AlignLeft,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Long Text',
  },
  select: {
    icon: List,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/50',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Single Select',
  },
  multi_select: {
    icon: List,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/50',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Multi Select',
  },
  yes_no: {
    icon: ThumbsUp,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
    label: 'Yes / No',
  },
}

function VisualFlowBuilder({
  questions,
  onChange,
  formType,
  brandColor,
  form,
}: {
  questions: CustomQuestion[]
  onChange: (questions: CustomQuestion[]) => void
  formType: string
  brandColor: string
  form: any
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const selectedQuestion = selectedIndex !== null ? questions[selectedIndex] : null

  function addQuestion(type: CustomQuestion['type']) {
    const newQ: CustomQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: '',
      required: false,
      options: type === 'select' || type === 'multi_select' ? ['Option 1', 'Option 2'] : undefined,
      order: questions.length,
    }
    onChange([...questions, newQ])
    setSelectedIndex(questions.length)
  }

  function updateQuestion(index: number, updates: Partial<CustomQuestion>) {
    const next = [...questions]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })))
    if (selectedIndex === index) setSelectedIndex(null)
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1)
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...questions]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    onChange(next.map((q, i) => ({ ...q, order: i })))
    if (selectedIndex === dragIndex) setSelectedIndex(dropIndex)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // Build the list of all flow nodes (including fixed primary questions for NPS/CSAT/CES)
  const primaryNodes: { label: string; typeLabel: string; color: string; bgColor: string; borderColor: string; icon: typeof Star; fixed: boolean }[] = []

  if (formType === 'nps') {
    primaryNodes.push({
      label: 'How likely are you to recommend us?',
      typeLabel: 'NPS (0-10)',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      borderColor: 'border-violet-200 dark:border-violet-800',
      icon: BarChart3,
      fixed: true,
    })
  } else if (formType === 'csat') {
    primaryNodes.push({
      label: 'How satisfied are you with our service?',
      typeLabel: 'CSAT (1-5)',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      borderColor: 'border-blue-200 dark:border-blue-800',
      icon: Star,
      fixed: true,
    })
  } else if (formType === 'ces') {
    primaryNodes.push({
      label: 'How easy was it to get what you needed?',
      typeLabel: 'CES (1-7)',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      borderColor: 'border-amber-200 dark:border-amber-800',
      icon: BarChart3,
      fixed: true,
    })
  }

  const questionTypes: { value: CustomQuestion['type']; label: string }[] = [
    { value: 'rating', label: 'Rating (1-5)' },
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'select', label: 'Single Select' },
    { value: 'multi_select', label: 'Multi Select' },
    { value: 'yes_no', label: 'Yes / No' },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Flow Column */}
      <div className="lg:col-span-3">
        <div className="flex flex-col items-center">
          {/* Start Node */}
          <div className="flex items-center gap-2 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 px-5 py-2.5 bg-muted/30">
            <Circle className="size-3 fill-green-500 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">Form Start</span>
          </div>

          {/* Connector line from start */}
          <svg width="2" height="32" className="text-gray-300 dark:text-gray-600">
            <line x1="1" y1="0" x2="1" y2="32" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
          </svg>

          {/* Primary fixed questions */}
          {primaryNodes.map((node, i) => {
            const Icon = node.icon
            return (
              <div key={`primary-${i}`} className="flex flex-col items-center w-full max-w-md">
                <div
                  className={`w-full rounded-xl border-2 ${node.borderColor} ${node.bgColor} p-4 shadow-sm relative`}
                >
                  <div className="absolute -top-2.5 left-4">
                    <Badge variant="secondary" className="text-[10px] bg-white dark:bg-gray-900 shadow-sm">
                      Fixed
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className={`flex size-9 items-center justify-center rounded-lg ${node.bgColor} border ${node.borderColor}`}>
                      <Icon className={`size-4.5 ${node.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{node.label}</p>
                      <p className="text-xs text-muted-foreground">{node.typeLabel}</p>
                    </div>
                  </div>
                </div>
                <svg width="2" height="32" className="text-gray-300 dark:text-gray-600">
                  <line x1="1" y1="0" x2="1" y2="32" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                </svg>
              </div>
            )
          })}

          {/* Custom question nodes */}
          {questions.map((q, index) => {
            const config = questionTypeConfig[q.type] ?? questionTypeConfig.text
            const Icon = config.icon
            const isSelected = selectedIndex === index
            const isDragging = dragIndex === index
            const isDragOver = dragOverIndex === index

            return (
              <div key={q.id} className="flex flex-col items-center w-full max-w-md">
                {/* Drop zone indicator */}
                {isDragOver && dragIndex !== index && (
                  <div className="w-full h-1 rounded-full bg-primary mb-1 transition-all" />
                )}
                <div
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverIndex(index)
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setDragOverIndex(null)
                  }}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full rounded-xl border-2 p-4 shadow-sm cursor-pointer transition-all group relative ${
                    isDragging
                      ? 'opacity-40 border-dashed scale-95'
                      : isSelected
                        ? `${config.borderColor} ${config.bgColor} ring-2 ring-primary/30 scale-[1.02]`
                        : `${config.borderColor} ${config.bgColor} hover:shadow-md hover:scale-[1.01]`
                  }`}
                >
                  {/* Drag handle */}
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                    <GripVertical className="size-5 text-muted-foreground" />
                  </div>

                  {/* Question number badge */}
                  <div className="absolute -top-2.5 left-4">
                    <Badge variant="secondary" className="text-[10px] bg-white dark:bg-gray-900 shadow-sm">
                      Q{index + 1}
                    </Badge>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeQuestion(index)
                    }}
                    className="absolute -top-2 -right-2 size-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                  >
                    <X className="size-3" />
                  </button>

                  <div className="flex items-center gap-3 mt-1">
                    <div className={`flex size-9 items-center justify-center rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                      <Icon className={`size-4.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {q.label || <span className="italic text-muted-foreground">Untitled question</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{config.label}</span>
                        {q.required && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-500 dark:border-red-700">
                            Required
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="size-2.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>

                  {/* Options preview for select types */}
                  {(q.type === 'select' || q.type === 'multi_select') && q.options && q.options.length > 0 && (
                    <div className="mt-2 ml-12 flex flex-wrap gap-1">
                      {q.options.slice(0, 3).map((opt, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-gray-800/60 text-muted-foreground">
                          {opt}
                        </span>
                      ))}
                      {q.options.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                          +{q.options.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Connector line */}
                <svg width="2" height="32" className="text-gray-300 dark:text-gray-600">
                  <line x1="1" y1="0" x2="1" y2="32" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                </svg>
              </div>
            )
          })}

          {/* Add question button */}
          <Select onValueChange={(v) => addQuestion(v as CustomQuestion['type'])}>
            <SelectTrigger className="w-auto gap-2 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 px-5 py-2.5 bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <Plus className="size-4" />
              <span className="text-sm">Add Question</span>
            </SelectTrigger>
            <SelectContent>
              {questionTypes.map((qt) => {
                const cfg = questionTypeConfig[qt.value]
                const QIcon = cfg.icon
                return (
                  <SelectItem key={qt.value} value={qt.value}>
                    <div className="flex items-center gap-2">
                      <QIcon className={`size-3.5 ${cfg.color}`} />
                      {qt.label}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {/* Connector line to end */}
          <svg width="2" height="32" className="text-gray-300 dark:text-gray-600">
            <line x1="1" y1="0" x2="1" y2="32" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
          </svg>

          {/* End node */}
          <div className="flex items-center gap-2 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 px-5 py-2.5 bg-muted/30">
            <CheckCircle2 className="size-3 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">Thank You</span>
          </div>
        </div>
      </div>

      {/* Right side: selected question editor + phone preview */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 space-y-4">
          {/* Selected question editor */}
          {selectedQuestion !== null && selectedIndex !== null ? (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Edit Question #{selectedIndex + 1}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setSelectedIndex(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">Question Text</Label>
                <Input
                  value={selectedQuestion.label}
                  onChange={(e) => updateQuestion(selectedIndex, { label: e.target.value })}
                  placeholder="Enter your question..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select
                  value={selectedQuestion.type}
                  onValueChange={(v) =>
                    updateQuestion(selectedIndex, {
                      type: v as CustomQuestion['type'],
                      options:
                        v === 'select' || v === 'multi_select'
                          ? selectedQuestion.options ?? ['Option 1', 'Option 2']
                          : undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((qt) => (
                      <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedQuestion.type === 'select' || selectedQuestion.type === 'multi_select') && (
                <div className="space-y-2">
                  <Label className="text-xs">Options (one per line)</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={(selectedQuestion.options ?? []).join('\n')}
                    onChange={(e) =>
                      updateQuestion(selectedIndex, {
                        options: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder={'Option 1\nOption 2\nOption 3'}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedQuestion.required}
                  onCheckedChange={(checked) => updateQuestion(selectedIndex, { required: checked })}
                />
                <Label className="text-xs">Required</Label>
              </div>
              <Separator />
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => removeQuestion(selectedIndex)}
              >
                <Trash2 className="size-3.5" />
                Delete Question
              </Button>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Smartphone className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click a question card to edit it</p>
                <p className="text-xs text-muted-foreground mt-1">Drag cards to reorder</p>
              </div>
            </Card>
          )}

          {/* Phone preview */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 text-center">
              {selectedQuestion ? 'Question Preview' : 'Form Preview'}
            </h2>
            <div className="mx-auto w-[300px] h-[520px] border-2 border-gray-300 dark:border-gray-700 rounded-[32px] overflow-hidden shadow-xl bg-white dark:bg-gray-950 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-300 dark:bg-gray-700 rounded-b-xl z-10" />
              <div className="h-full pt-7 overflow-y-auto">
                {selectedQuestion && selectedIndex !== null ? (
                  /* Single question preview */
                  <div className="flex flex-col h-full bg-white dark:bg-gray-950 p-5">
                    <div className="h-1 w-10 rounded-full mb-4" style={{ backgroundColor: brandColor }} />
                    <p className="text-[10px] text-muted-foreground mb-1">Question {selectedIndex + 1} of {questions.length}</p>
                    <Progress value={((selectedIndex + 1) / questions.length) * 100} className="h-1 mb-4" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {selectedQuestion.label || 'Untitled question'}
                      {selectedQuestion.required && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                    {selectedQuestion.type === 'rating' && (
                      <div className="flex gap-1.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className="size-6 text-gray-300 dark:text-gray-600" />
                        ))}
                      </div>
                    )}
                    {selectedQuestion.type === 'text' && (
                      <div className="h-9 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400">
                        Short answer...
                      </div>
                    )}
                    {selectedQuestion.type === 'textarea' && (
                      <div className="h-20 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400">
                        Long answer...
                      </div>
                    )}
                    {selectedQuestion.type === 'select' && (
                      <div className="h-9 rounded border bg-gray-50 dark:bg-gray-900 p-2 text-[10px] text-gray-400 flex items-center justify-between">
                        <span>Select an option</span>
                        <ChevronDown className="size-3" />
                      </div>
                    )}
                    {selectedQuestion.type === 'multi_select' && (
                      <div className="space-y-1.5">
                        {(selectedQuestion.options ?? ['Option 1', 'Option 2']).map((opt, j) => (
                          <div key={j} className="flex items-center gap-2 text-[11px] text-gray-600">
                            <div className="size-3.5 rounded border" />
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedQuestion.type === 'yes_no' && (
                      <div className="flex gap-2">
                        <div className="flex-1 rounded border py-2 text-center text-[11px] font-medium text-gray-600">
                          Yes
                        </div>
                        <div className="flex-1 rounded border py-2 text-center text-[11px] font-medium text-gray-600">
                          No
                        </div>
                      </div>
                    )}
                    <div className="mt-auto pt-4">
                      <button
                        className="w-full rounded-lg py-2 text-xs font-medium text-white"
                        style={{ backgroundColor: brandColor }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Full form mini preview */
                  <FormPhonePreview
                    form={{ ...form, name: form.name, config: { ...form.config, description: form.config?.description } }}
                    brandColor={brandColor}
                    thankYouMessage={form.config?.thankYouMessage ?? 'Thank you!'}
                    customQuestions={questions}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TruFormDetailPage() {
  const params = useParams()
  const router = useRouter()
  const formId = params.id as string
  const utils = trpc.useUtils()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [brandColor, setBrandColor] = useState('#6366f1')
  const [logoUrl, setLogoUrl] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [npsDetractorFollowUp, setNpsDetractorFollowUp] = useState('')
  const [npsPromoterFollowUp, setNpsPromoterFollowUp] = useState('')

  const formQuery = trpc.truform.getById.useQuery(
    { id: formId },
    { enabled: !!formId }
  )

  const updateMutation = trpc.truform.update.useMutation({
    onSuccess: () => {
      toast.success('Form saved')
      setEditingName(false)
      utils.truform.getById.invalidate({ id: formId })
    },
    onError: (error) => toast.error(error.message || 'Failed to update'),
  })

  const activateMutation = trpc.truform.activate.useMutation({
    onSuccess: () => {
      toast.success('Form activated')
      utils.truform.getById.invalidate({ id: formId })
    },
    onError: (error) => toast.error(error.message || 'Failed to activate'),
  })

  const archiveMutation = trpc.truform.archive.useMutation({
    onSuccess: () => {
      toast.success('Form archived')
      utils.truform.getById.invalidate({ id: formId })
    },
    onError: (error) => toast.error(error.message || 'Failed to archive'),
  })

  const form = formQuery.data

  useEffect(() => {
    if (form) {
      setName(form.name ?? '')
      setDescription(form.config?.description ?? '')
      setThankYouMessage(form.config?.thankYouMessage ?? 'Thank you for your feedback!')
      setBrandColor(form.config?.brandColor ?? '#6366f1')
      setLogoUrl(form.config?.logoUrl ?? '')
      setCustomQuestions(form.config?.questions ?? [])
      setNpsDetractorFollowUp(form.config?.npsDetractorFollowUp ?? 'What could we do better?')
      setNpsPromoterFollowUp(form.config?.npsPromoterFollowUp ?? 'What did you love about us?')
    }
  }, [form])

  if (formQuery.isLoading) return <DetailSkeleton />

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Form not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/dashboard/truforms')}
        >
          Back to TruForms
        </Button>
      </div>
    )
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/f/${form.slug ?? form.id}`
    : `/f/${form.slug ?? form.id}`

  const handleSave = () => {
    updateMutation.mutate({
      id: formId,
      name,
      config: {
        ...form.config,
        description,
        thankYouMessage,
        brandColor,
        logoUrl,
        questions: customQuestions,
        npsDetractorFollowUp,
        npsPromoterFollowUp,
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/truforms')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                  className="h-8 text-lg font-bold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <CheckCircle2 className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold truncate cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => setEditingName(true)}
                title="Click to edit name"
              >
                {form.name}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs ${typeColors[form.type ?? 'custom']}`} variant="secondary">
                {form.type?.toUpperCase()}
              </Badge>
              <Badge className={`text-xs ${statusColors[form.status ?? 'draft']}`} variant="secondary">
                {form.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {form.status !== 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => activateMutation.mutate({ id: formId })}
              disabled={activateMutation.isPending}
            >
              <Play className="size-4" />
              Activate
            </Button>
          )}
          {form.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveMutation.mutate({ id: formId })}
              disabled={archiveMutation.isPending}
            >
              <Archive className="size-4" />
              Archive
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.open(shareUrl, '_blank')}>
            <Eye className="size-4" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="size-4" />
            QR Code
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl)
              toast.success('Link copied')
            }}
          >
            <Share2 className="size-4" />
            Share
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="size-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="editor" className="space-y-6">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="visual">
            <GitBranch className="size-3.5" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="size-3.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="responses">
            <ClipboardList className="size-3.5" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="size-3.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ─── Editor Tab ─── */}
        <TabsContent value="editor">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6">
              {/* Form Settings */}
              <Card className="p-6 space-y-4">
                <h2 className="font-semibold">Form Settings</h2>
                <div className="space-y-2">
                  <Label>Form Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Form name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description / Subtitle</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short description shown below the title"
                  />
                </div>
                <Separator />
                <h3 className="text-sm font-medium">Branding</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="size-9 cursor-pointer rounded border"
                      />
                      <Input
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo URL</Label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Thank You Message</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={thankYouMessage}
                    onChange={(e) => setThankYouMessage(e.target.value)}
                    placeholder="Message shown after submission"
                  />
                </div>
              </Card>

              {/* Questions Section */}
              <Card className="p-6 space-y-4">
                <h2 className="font-semibold">Questions</h2>
                <Separator />

                {/* NPS Questions */}
                {form.type === 'nps' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={typeColors.nps} variant="secondary">Primary</Badge>
                        <span className="text-sm font-medium">NPS Question (0-10 scale)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        "How likely are you to recommend us to a friend or colleague?"
                      </p>
                      <p className="text-[10px] text-muted-foreground italic">
                        This question is fixed for NPS forms.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up for Detractors (0-6)</Label>
                      <Input
                        value={npsDetractorFollowUp}
                        onChange={(e) => setNpsDetractorFollowUp(e.target.value)}
                        placeholder="What could we do better?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up for Promoters (9-10)</Label>
                      <Input
                        value={npsPromoterFollowUp}
                        onChange={(e) => setNpsPromoterFollowUp(e.target.value)}
                        placeholder="What did you love about us?"
                      />
                    </div>
                  </div>
                )}

                {/* CSAT Questions */}
                {form.type === 'csat' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={typeColors.csat} variant="secondary">Primary</Badge>
                        <span className="text-sm font-medium">CSAT Question (1-5 stars)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        "How satisfied are you with our service?"
                      </p>
                    </div>
                    <Separator />
                    <CustomQuestionBuilder
                      questions={customQuestions}
                      onChange={setCustomQuestions}
                    />
                  </div>
                )}

                {/* CES Questions */}
                {form.type === 'ces' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={typeColors.ces} variant="secondary">Primary</Badge>
                        <span className="text-sm font-medium">CES Question (1-7 scale)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        "How easy was it to get what you needed today?"
                      </p>
                    </div>
                    <Separator />
                    <CustomQuestionBuilder
                      questions={customQuestions}
                      onChange={setCustomQuestions}
                    />
                  </div>
                )}

                {/* Custom Questions */}
                {form.type === 'custom' && (
                  <CustomQuestionBuilder
                    questions={customQuestions}
                    onChange={setCustomQuestions}
                  />
                )}
              </Card>
            </div>

            {/* Phone Preview - Right Side */}
            <div className="lg:col-span-2">
              <div className="sticky top-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  Mobile Preview
                </h2>
                <div className="mx-auto w-[375px] h-[667px] border-2 border-gray-300 dark:border-gray-700 rounded-[40px] overflow-hidden shadow-xl bg-white dark:bg-gray-950 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-gray-300 dark:bg-gray-700 rounded-b-2xl z-10" />
                  <div className="h-full pt-8">
                    <FormPhonePreview
                      form={form}
                      brandColor={brandColor}
                      thankYouMessage={thankYouMessage}
                      customQuestions={customQuestions}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Visual Flow Tab ─── */}
        <TabsContent value="visual">
          <VisualFlowBuilder
            questions={customQuestions}
            onChange={setCustomQuestions}
            formType={form.type ?? 'custom'}
            brandColor={brandColor}
            form={form}
          />
        </TabsContent>

        {/* ─── Preview Tab (Full Page) ─── */}
        <TabsContent value="preview">
          <div className="flex justify-center">
            <div className="mx-auto w-[375px] h-[667px] border-2 border-gray-300 dark:border-gray-700 rounded-[40px] overflow-hidden shadow-xl bg-white dark:bg-gray-950 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-gray-300 dark:bg-gray-700 rounded-b-2xl z-10" />
              <div className="h-full pt-8">
                <FormPhonePreview
                  form={{ ...form, name, config: { ...form.config, description } }}
                  brandColor={brandColor}
                  thankYouMessage={thankYouMessage}
                  customQuestions={customQuestions}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Responses Tab ─── */}
        <TabsContent value="responses">
          <ResponsesTab formId={formId} />
        </TabsContent>

        {/* ─── Analytics Tab ─── */}
        <TabsContent value="analytics">
          <AnalyticsTab formId={formId} formType={form.type ?? 'custom'} />
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <QrCodeDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        formSlug={form.slug ?? form.id}
        formId={formId}
      />
    </div>
  )
}
