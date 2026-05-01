'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  Plus,
  Pencil,
  Archive,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Phase 3 Stage F — surveys list + create.
 *
 * Replaces the old /dashboard/journeys and /dashboard/truforms list pages
 * with a single unified surveys list. Filter by template (quick / deep)
 * and status. Click a row to open the editor at /dashboard/surveys/[id].
 */

type FilterTemplate = 'all' | 'quick' | 'deep'
type FilterStatus = 'all' | 'draft' | 'active' | 'archived'

export default function SurveysListPage() {
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  const utils = trpc.useUtils()

  const [tplFilter, setTplFilter] = useState<FilterTemplate>('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTemplate, setNewTemplate] = useState<'quick' | 'deep'>('quick')
  const [newDeepType, setNewDeepType] = useState<'csat' | 'nps' | 'ces' | 'custom'>('csat')

  const surveysQuery = trpc.survey.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      template: tplFilter === 'all' ? undefined : tplFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    { enabled: !!currentWorkspaceId },
  )

  const createMutation = trpc.survey.create.useMutation({
    onSuccess: (created) => {
      toast.success('Survey created')
      utils.survey.list.invalidate()
      setCreateOpen(false)
      setNewName('')
      // Hop straight to the editor for the new row.
      if (created?.id) {
        window.location.href = `/dashboard/surveys/${created.id}`
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create survey')
    },
  })

  const archiveMutation = trpc.survey.archive.useMutation({
    onSuccess: () => {
      toast.success('Survey archived')
      utils.survey.list.invalidate()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to archive')
    },
  })

  const surveys = (surveysQuery.data ?? []) as Array<{
    id: string
    name: string
    slug: string
    template: 'quick' | 'deep'
    mode: 'intelligent' | 'builder'
    status: 'draft' | 'active' | 'archived'
    settings: Record<string, unknown>
    legacyJourneyId: string | null
    legacyTruformId: string | null
    createdAt: string | Date
  }>

  const counts = useMemo(() => {
    return {
      all: surveys.length,
      quick: surveys.filter((s) => s.template === 'quick').length,
      deep: surveys.filter((s) => s.template === 'deep').length,
    }
  }, [surveys])

  function handleCreate() {
    if (!currentWorkspaceId || !newName.trim()) return
    const settings: Record<string, unknown> = {}
    if (newTemplate === 'deep') settings.type = newDeepType
    createMutation.mutate({
      workspaceId: currentWorkspaceId,
      name: newName.trim(),
      template: newTemplate,
      settings,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6" />
            Surveys
          </h1>
          <p className="text-sm text-muted-foreground">
            Quick (single-screen) and Deep (multi-question) surveys, unified.
            Each one runs through the typed step engine.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Create Survey
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a survey</DialogTitle>
              <DialogDescription>
                Pick a template; you can edit the step graph in the editor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-survey-name">Survey name</Label>
                <Input
                  id="new-survey-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dine-in feedback"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={newTemplate}
                  onValueChange={(v) => setNewTemplate(v as 'quick' | 'deep')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">
                      Quick — single-screen QR feedback
                    </SelectItem>
                    <SelectItem value="deep">
                      Deep — multi-question survey
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newTemplate === 'deep' && (
                <div className="space-y-2">
                  <Label>Deep type</Label>
                  <Select
                    value={newDeepType}
                    onValueChange={(v) =>
                      setNewDeepType(v as 'csat' | 'nps' | 'ces' | 'custom')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csat">CSAT</SelectItem>
                      <SelectItem value="nps">NPS</SelectItem>
                      <SelectItem value="ces">CES</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm">
          {([
            { value: 'all', label: 'All', count: counts.all },
            { value: 'quick', label: 'Quick', count: counts.quick },
            { value: 'deep', label: 'Deep', count: counts.deep },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTplFilter(tab.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tplFilter === tab.value
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-muted-foreground">({tab.count})</span>
            </button>
          ))}
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as FilterStatus)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {surveysQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No surveys yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a quick QR-feedback survey or a deep multi-question survey
            to start collecting responses.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create Survey
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {surveys.map((s) => {
            const isLegacy = !!(s.legacyJourneyId || s.legacyTruformId)
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">
                      {s.name}
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge
                        variant="outline"
                        className={
                          s.template === 'quick'
                            ? 'text-blue-700 border-blue-300 bg-blue-50'
                            : 'text-purple-700 border-purple-300 bg-purple-50'
                        }
                      >
                        {s.template}
                      </Badge>
                      <Badge
                        variant={
                          s.status === 'active'
                            ? 'default'
                            : s.status === 'draft'
                              ? 'outline'
                              : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    /{s.template === 'quick' ? 'j' : 'f'}/{s.slug}
                    {isLegacy && (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        · migrated
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between border-t pt-3">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/surveys/${s.id}`}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <div className="flex gap-1">
                    {s.status === 'active' && (
                      <Button asChild variant="ghost" size="icon-sm">
                        <a
                          href={`/${s.template === 'quick' ? 'j' : 'f'}/${s.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Preview public URL"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                    {s.status !== 'archived' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => archiveMutation.mutate({ id: s.id })}
                        disabled={archiveMutation.isPending}
                        aria-label="Archive"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
