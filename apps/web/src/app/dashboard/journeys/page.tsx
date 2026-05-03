'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  Plus,
  Pencil,
  Archive,
  ExternalLink,
  Loader2,
  QrCode,
  Download,
  Copy,
  Sparkles,
  ChevronDown,
  Zap,
  FileText,
  Wand2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateCustomJourneyWizard } from '@/components/surveys/create-custom-journey-wizard'

/**
 * Phase 3 Stage F — surveys list + create.
 *
 * The single unified surveys list (the old /dashboard/journeys and
 * /dashboard/truforms pages were deleted in Phase 5). Filter by template
 * (quick / deep) and status. Click a row to open the editor at
 * /dashboard/surveys/[id].
 */

// Hotfix §5 leakage fix — filter chips now cover all 4 templates so
// owners can scope to adaptive (§2) and custom (§3) journeys, not just
// quick/deep. List query already accepts the wider enum.
type FilterTemplate = 'all' | 'adaptive' | 'quick' | 'deep' | 'custom'
type FilterStatus = 'all' | 'draft' | 'active' | 'archived'

// All 4 template values that survey.create / survey.createFromWizard
// emit. quick is the manual single-screen flow; adaptive is §2's
// random-metric flow; deep is the multi-question form; custom is the
// §3 wizard's decision-tree output.
type CreateTemplate = 'adaptive' | 'quick' | 'deep'

export default function SurveysListPage() {
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  const utils = trpc.useUtils()

  const [tplFilter, setTplFilter] = useState<FilterTemplate>('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  // Hotfix-5 — per-page location filter (no global switcher; matches
  // the Inbox / Dashboard "By Location" / Responses pattern). 'all' is
  // the default; picking a location narrows the survey list to journeys
  // bound to that location.
  const [locFilter, setLocFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [newName, setNewName] = useState('')
  // Hotfix-5 — every QR is bound to a single location so responses
  // attribute correctly. Auto-picked for single-location workspaces;
  // required for multi-location.
  const [newLocationId, setNewLocationId] = useState<string | undefined>(undefined)
  // Hotfix §5 leakage fix — was hardcoded to 'quick' | 'deep'. Now picked
  // by the unified "+ New Journey" dropdown so owners can also create
  // adaptive (§2) journeys without dropping into the wizard for the
  // random-metric short-circuit.
  const [newTemplate, setNewTemplate] = useState<CreateTemplate>('adaptive')
  const [newDeepType, setNewDeepType] = useState<'csat' | 'nps' | 'ces' | 'custom'>('csat')

  // QR dialog — restored from the deleted /dashboard/journeys page.
  // Adaptive surveys reuse the /j/{slug} URL space (same legacy QR
  // generator as quick); custom surveys also use /j/{slug}. Deep
  // surveys use /f/{slug} with a separate generator.
  const [qrSurvey, setQrSurvey] = useState<{
    id: string
    name: string
    slug: string
    template: 'quick' | 'deep' | 'adaptive' | 'custom'
    legacyId: string | null
  } | null>(null)

  const surveysQuery = trpc.survey.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      template: tplFilter === 'all' ? undefined : tplFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      // Hotfix-5 — location filter; backend already supports it on
      // listSurveysSchema.
      locationId: locFilter === 'all' ? undefined : locFilter,
    },
    { enabled: !!currentWorkspaceId },
  )

  // Workspace locations for the create-dialog dropdown + per-card chip
  // lookup + filter chip-set.
  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )
  const workspaceLocations = (locationsQuery.data ?? []) as Array<{
    id: string
    name: string
    city: string | null
    state: string | null
    isActive: boolean
  }>
  const activeLocations = workspaceLocations.filter((l) => l.isActive)
  const locationsById = useMemo(
    () => new Map(workspaceLocations.map((l) => [l.id, l])),
    [workspaceLocations],
  )

  // Auto-pick the only active location when the create dialog opens
  // for a single-location workspace.
  useEffect(() => {
    if (createOpen && activeLocations.length === 1 && !newLocationId) {
      setNewLocationId(activeLocations[0]?.id)
    }
  }, [createOpen, activeLocations, newLocationId])

  const createMutation = trpc.survey.create.useMutation({
    onSuccess: (created) => {
      toast.success('Customer journey created')
      utils.survey.list.invalidate()
      setCreateOpen(false)
      setNewName('')
      // Hop straight to the editor for the new row.
      if (created?.id) {
        window.location.href = `/dashboard/journeys/${created.id}`
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create customer journey')
    },
  })

  const archiveMutation = trpc.survey.archive.useMutation({
    onSuccess: () => {
      toast.success('Customer journey archived')
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
    template: 'quick' | 'deep' | 'adaptive' | 'custom'
    mode: 'intelligent' | 'builder'
    status: 'draft' | 'active' | 'archived'
    // Hotfix-5 — locationId on each survey row drives the location
    // chip on the card. Already populated by the backend list query.
    locationId: string | null
    settings: Record<string, unknown>
    legacyJourneyId: string | null
    legacyTruformId: string | null
    createdAt: string | Date
  }>

  const counts = useMemo(() => {
    return {
      all: surveys.length,
      adaptive: surveys.filter((s) => s.template === 'adaptive').length,
      quick: surveys.filter((s) => s.template === 'quick').length,
      deep: surveys.filter((s) => s.template === 'deep').length,
      custom: surveys.filter((s) => s.template === 'custom').length,
    }
  }, [surveys])

  function handleCreate() {
    if (!currentWorkspaceId || !newName.trim()) return
    // Hotfix-5 — multi-location workspaces require explicit location
    // pick before create. Single-location auto-fills via the effect.
    if (activeLocations.length > 1 && !newLocationId) {
      toast.error('Pick a location for this journey first.')
      return
    }
    const settings: Record<string, unknown> = {}
    if (newTemplate === 'deep') settings.type = newDeepType
    createMutation.mutate({
      workspaceId: currentWorkspaceId,
      // Hotfix-5 — bind the new journey to the selected location so
      // its QR is location-specific and responses attribute correctly.
      locationId: newLocationId,
      name: newName.trim(),
      template: newTemplate,
      settings,
    })
  }

  /**
   * Open the create dialog with a specific template pre-selected. The
   * dropdown menu fans out into 3 of these (adaptive / quick / deep);
   * the 4th option (custom) skips the dialog and opens the §3 wizard.
   */
  function openCreateFor(template: CreateTemplate) {
    setNewTemplate(template)
    setNewName('')
    setNewLocationId(undefined)
    if (template === 'deep') setNewDeepType('csat')
    setCreateOpen(true)
  }

  // Owner-facing template metadata — drives the dropdown menu, the
  // dialog header, and the "New Journey" copy. Single source of truth
  // so vocabulary stays consistent across all three surfaces.
  const TEMPLATE_META: Record<
    CreateTemplate,
    { label: string; description: string }
  > = {
    adaptive: {
      label: 'Adaptive Journey',
      description:
        'Random metric per visit (CSAT / NPS / CES / NEV / CLI), threshold-based positive/negative routing. Recommended for most owners.',
    },
    quick: {
      label: 'Quick Survey',
      description:
        'Single-screen QR feedback. You pick one metric and the threshold; the renderer asks once and ends.',
    },
    deep: {
      label: 'Deep Survey',
      description:
        'Multi-question survey form with CSAT / NPS / CES presets or a custom 1–10 scale.',
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6" />
            Customer Journeys
          </h1>
          <p className="text-sm text-muted-foreground">
            Quick (single-screen) and Deep (multi-question) customer
            journeys, unified. Each one runs through the typed step engine.
          </p>
        </div>

        {/*
          Hotfix §5 leakage fix — single unified entry point for all 4
          journey types. Was two competing buttons ("Create Survey" +
          "+ New Custom Journey") with inconsistent vocabulary; owners
          couldn't tell what each one did. The dropdown surfaces all 4
          templates with one-line descriptions so the choice is obvious.
          - Adaptive / Quick / Deep → opens the simple create dialog
            with the template pre-selected.
          - Custom → opens the §3 wizard modal.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New Journey
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Pick a journey type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => openCreateFor('adaptive')}
              className="items-start gap-3 py-3"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Adaptive</span>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-[10px] text-primary"
                  >
                    Recommended
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal">
                  Random metric per visit (CSAT / NPS / CES / NEV / CLI),
                  threshold-based positive/negative routing.
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => openCreateFor('quick')}
              className="items-start gap-3 py-3"
            >
              <Zap className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">Quick Survey</div>
                <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal">
                  Single-screen QR feedback. You pick the metric.
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => openCreateFor('deep')}
              className="items-start gap-3 py-3"
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-violet-600" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">Deep Survey</div>
                <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal">
                  Multi-question form with CSAT / NPS / CES presets or
                  a custom 1–10 scale.
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setWizardOpen(true)}
              className="items-start gap-3 py-3"
            >
              <Wand2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">Custom Journey</div>
                <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal">
                  4-question wizard builds a decision-tree journey with
                  custom branches.
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Simple-create dialog for adaptive / quick / deep. Opened
            programmatically by the dropdown items via openCreateFor(); no
            DialogTrigger here. Custom journeys go through CreateCustom
            JourneyWizard (rendered below). */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Create {TEMPLATE_META[newTemplate].label}
              </DialogTitle>
              <DialogDescription>
                {TEMPLATE_META[newTemplate].description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-survey-name">Journey name</Label>
                <Input
                  id="new-survey-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dine-in feedback"
                  autoFocus
                />
              </div>
              {/* Hotfix-5 — location binding. Same 0/1/2+ rhythm as the
                  custom wizard: hidden for single-location workspaces
                  (auto-pick), required Select for 2+, amber hint for 0. */}
              {activeLocations.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="new-survey-location">
                    Which location is this journey for?
                  </Label>
                  <Select
                    value={newLocationId}
                    onValueChange={(v) => setNewLocationId(v)}
                  >
                    <SelectTrigger id="new-survey-location">
                      <SelectValue placeholder="Pick a location…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    QR will be tied to this location. Responses attribute
                    here.
                  </p>
                </div>
              )}
              {activeLocations.length === 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Will be tied to{' '}
                  <strong>{activeLocations[0]?.name}</strong> — your only
                  active location.
                </p>
              )}
              {activeLocations.length === 0 && (
                <p className="text-[11px] text-amber-700">
                  No active locations. Add one in <strong>Locations</strong>{' '}
                  before creating a journey.
                </p>
              )}
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
                      <SelectItem value="csat">CSAT — 1-5 satisfaction</SelectItem>
                      <SelectItem value="nps">NPS — 0-10 likelihood-to-recommend</SelectItem>
                      <SelectItem value="ces">CES — 1-7 effort score</SelectItem>
                      <SelectItem value="custom">Custom — 1-10 scale</SelectItem>
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
                disabled={
                  !newName.trim() ||
                  createMutation.isPending ||
                  activeLocations.length === 0 ||
                  (activeLocations.length > 1 && !newLocationId)
                }
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

      {/* Hotfix §3 (PR 1) — Wizard Custom Journey Builder modal. */}
      {currentWorkspaceId && (
        <CreateCustomJourneyWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          workspaceId={currentWorkspaceId}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm">
          {([
            { value: 'all', label: 'All', count: counts.all },
            { value: 'adaptive', label: 'Adaptive', count: counts.adaptive },
            { value: 'quick', label: 'Quick', count: counts.quick },
            { value: 'deep', label: 'Deep', count: counts.deep },
            { value: 'custom', label: 'Custom', count: counts.custom },
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

        {/* Hotfix-5 — location filter. Threshold relaxed in hotfix-6
            from `> 1` to `>= 1` so single-location workspaces still
            see the dropdown (visibility / discoverability — owner can
            see the feature exists). Hidden only when 0 active
            locations (nothing to filter). */}
        {activeLocations.length >= 1 && (
          <Select value={locFilter} onValueChange={setLocFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {activeLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  📍 {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
          <h3 className="mt-4 text-lg font-semibold">No customer journeys yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a quick QR-feedback journey or a deep multi-question journey
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
                    {/* Hotfix-2 — every non-deep template uses /j/{slug}. */}
                    /{s.template === 'deep' ? 'f' : 'j'}/{s.slug}
                    {isLegacy && (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        · migrated
                      </span>
                    )}
                    {/* Hotfix-5 — location chip per card so owners can
                        identify which QR is for which branch at a
                        glance. Single-location workspaces still see it
                        (consistent), 0-location surveys show "no
                        location" hint in amber. */}
                    {s.locationId && locationsById.get(s.locationId) ? (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        📍 {locationsById.get(s.locationId)!.name}
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        📍 No location
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between border-t pt-3">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/journeys/${s.id}`}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setQrSurvey({
                          id: s.id,
                          name: s.name,
                          slug: s.slug,
                          template: s.template,
                          legacyId:
                            s.template === 'quick'
                              ? s.legacyJourneyId
                              : s.legacyTruformId,
                        })
                      }
                      aria-label="Get QR code"
                      title="Get QR code"
                    >
                      <QrCode className="size-3.5" />
                    </Button>
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

      {/* QR dialog — restored from the deleted /dashboard/journeys page. */}
      <QrCodeDialog
        survey={qrSurvey}
        onClose={() => setQrSurvey(null)}
        currentWorkspaceId={currentWorkspaceId}
      />
    </div>
  )
}

function QrCodeDialog({
  survey,
  onClose,
  currentWorkspaceId,
}: {
  survey: {
    id: string
    name: string
    slug: string
    template: 'quick' | 'deep' | 'adaptive' | 'custom'
    legacyId: string | null
  } | null
  onClose: () => void
  currentWorkspaceId: string | null
}) {
  // Hotfix §5 leakage fix — adaptive (§2) and custom (§3) surveys use the
  // same /j/{slug} URL space as quick journeys, so they share the
  // journey QR generator. Only deep surveys go through the form QR
  // path. Treat every non-deep template as journey-style here.
  const isJourneyTemplate = !!survey && survey.template !== 'deep'

  // The QR backend's lookupJourneySlug / lookupFormSlug accepts either
  // the new surveys.id or the legacy_*_id, so we always pass surveys.id.
  // It returns the slug + a data URL.
  const qrQuery = trpc.qr.generateJourneyQr.useQuery(
    {
      journeyId: survey?.id ?? '',
      workspaceId: currentWorkspaceId ?? undefined,
      size: 300,
      format: 'png',
    },
    { enabled: isJourneyTemplate && !!currentWorkspaceId },
  )

  const formQrMutation = trpc.qr.generateFormQr.useMutation()

  const [deepDataUrl, setDeepDataUrl] = useState<string | null>(null)
  const [deepLoading, setDeepLoading] = useState(false)

  // For deep (form) surveys, the backend exposes generateFormQr as a
  // mutation rather than a query — fire it once when the dialog opens.
  useEffect(() => {
    if (!survey || survey.template !== 'deep' || !currentWorkspaceId) {
      setDeepDataUrl(null)
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
          setDeepDataUrl(typeof data === 'string' ? data : data?.qrDataUrl ?? null)
          setDeepLoading(false)
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to generate QR')
          setDeepLoading(false)
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.id])

  const dataUrl = isJourneyTemplate ? qrQuery.data?.qrDataUrl : deepDataUrl
  const isLoading = isJourneyTemplate ? qrQuery.isLoading : deepLoading
  const publicUrl = survey
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${
        isJourneyTemplate ? 'j' : 'f'
      }/${survey.slug}`
    : ''

  function handleDownload() {
    if (!dataUrl || !survey) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${survey.slug}-qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handleCopyUrl() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl).then(
      () => toast.success('Public URL copied'),
      () => toast.error('Failed to copy'),
    )
  }

  return (
    <Dialog open={!!survey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR code for {survey?.name}</DialogTitle>
          <DialogDescription>
            Scanning this opens{' '}
            <code className="rounded bg-muted px-1 text-xs">{publicUrl}</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-3">
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
              onClick={handleCopyUrl}
            >
              <Copy className="size-4" />
              Copy URL
            </Button>
            <Button
              className="flex-1"
              onClick={handleDownload}
              disabled={!dataUrl}
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
