'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Settings,
  Loader2,
  Shield,
  Star,
  Clock,
  Users,
  Zap,
  Building,
  Building2,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Phase 2 Stage E (frontend) — escalation rules editor.
 *
 * Rewritten to use the real cxRouting tRPC namespace (the previous
 * version called trpc.escalation.* which never existed; the page was
 * silently disconnected from the backend).
 *
 * Field shape matches the backend Zod schemas exactly:
 *   triggerType: 'rating_threshold' | 'aspect_match' | 'keyword_match'
 *              | 'sentiment' | 'manual'
 *   triggerConfig: Record<string, unknown>  (shape per triggerType)
 *   slaMinutes: integer (NOT slaHours — UI displays in hours but stores
 *                       minutes per the schema)
 *   priority: 'low' | 'medium' | 'high' | 'critical'
 *   assignToUserId / assignToRole: optional
 *   scope: 'organization' | 'workspace' | 'location' (Phase 2 Stage E)
 *   locationId: required when scope='location'
 */

const TRIGGER_TYPES = [
  {
    value: 'rating_threshold',
    label: 'Rating below threshold',
    icon: Star,
    description: 'Escalate when review rating is at or below a threshold.',
    valueLabel: 'Rating threshold (1-5)',
    valueKey: 'maxRating',
    valueType: 'number' as const,
    defaultValue: '3',
  },
  {
    value: 'keyword_match',
    label: 'Keyword match',
    icon: Zap,
    description:
      'Escalate when the review text contains specific keywords (comma-separated).',
    valueLabel: 'Keywords',
    valueKey: 'keywords',
    valueType: 'text' as const,
    defaultValue: 'refund, complaint, terrible',
  },
  {
    value: 'sentiment',
    label: 'Negative sentiment',
    icon: AlertTriangle,
    description: 'Escalate on negative sentiment detection (no extra config).',
    valueLabel: '',
    valueKey: '',
    valueType: 'none' as const,
    defaultValue: '',
  },
  {
    value: 'aspect_match',
    label: 'Aspect match',
    icon: Zap,
    description:
      'Escalate when the review mentions a specific business aspect.',
    valueLabel: 'Aspect',
    valueKey: 'aspect',
    valueType: 'text' as const,
    defaultValue: '',
  },
  {
    value: 'manual',
    label: 'Manual only',
    icon: Settings,
    description:
      'Never auto-fires. Used to define an SLA / assignee for manual escalations.',
    valueLabel: '',
    valueKey: '',
    valueType: 'none' as const,
    defaultValue: '',
  },
] as const

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
] as const

type TriggerType = (typeof TRIGGER_TYPES)[number]['value']
type Priority = (typeof PRIORITY_OPTIONS)[number]['value']
type RuleScope = 'organization' | 'workspace' | 'location'

interface EscalationRule {
  id: string
  name: string
  triggerType: TriggerType
  triggerConfig: Record<string, unknown>
  assignToUserId?: string | null
  assignToRole?: string | null
  priority: Priority
  slaMinutes?: number | null
  isActive: boolean
  scope?: RuleScope
  organizationId?: string | null
  locationId?: string | null
  sortOrder?: number
}

function RuleSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function EscalationRulesPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [ruleName, setRuleName] = useState('')
  const [triggerType, setTriggerType] = useState<TriggerType>('rating_threshold')
  const [triggerValue, setTriggerValue] = useState('3')
  const [assignToUserId, setAssignToUserId] = useState<string>('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [slaHoursDisplay, setSlaHoursDisplay] = useState('24') // display unit
  const [isActive, setIsActive] = useState(true)
  const [scope, setScope] = useState<RuleScope>('workspace')
  const [scopeLocationId, setScopeLocationId] = useState<string>('')

  // Queries
  const rulesQuery = trpc.cxRouting.listRules.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )

  const membersQuery = trpc.member.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )

  // Mutations
  const createRule = trpc.cxRouting.createRule.useMutation({
    onSuccess: () => {
      toast.success('Escalation rule created')
      utils.cxRouting.listRules.invalidate()
      resetForm()
      setShowForm(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create rule')
    },
  })

  const updateRule = trpc.cxRouting.updateRule.useMutation({
    onSuccess: () => {
      toast.success('Escalation rule updated')
      utils.cxRouting.listRules.invalidate()
      resetForm()
      setShowForm(false)
      setEditingRule(null)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update rule')
    },
  })

  const deleteRule = trpc.cxRouting.deleteRule.useMutation({
    onSuccess: () => {
      toast.success('Escalation rule deleted')
      utils.cxRouting.listRules.invalidate()
      setDeleteId(null)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete rule')
    },
  })

  const rules: EscalationRule[] =
    ((rulesQuery.data ?? []) as EscalationRule[]) ?? []
  const teamMembers = (membersQuery.data ?? []) as Array<{
    userId?: string
    id?: string
    userName?: string
    name?: string
    email?: string
  }>
  const locations = (locationsQuery.data ?? []) as Array<{
    id: string
    name: string
  }>

  function resetForm() {
    setRuleName('')
    setTriggerType('rating_threshold')
    setTriggerValue('3')
    setAssignToUserId('')
    setPriority('medium')
    setSlaHoursDisplay('24')
    setIsActive(true)
    setScope('workspace')
    setScopeLocationId('')
    setEditingRule(null)
  }

  function buildTriggerConfig(): Record<string, unknown> {
    const def = TRIGGER_TYPES.find((t) => t.value === triggerType)
    if (!def || def.valueType === 'none' || !def.valueKey) return {}
    if (def.valueType === 'number') {
      const n = parseFloat(triggerValue)
      if (Number.isFinite(n)) return { [def.valueKey]: n }
      return {}
    }
    if (def.valueKey === 'keywords') {
      const list = triggerValue
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      return { keywords: list }
    }
    return { [def.valueKey]: triggerValue }
  }

  function readTriggerValueFromConfig(
    type: TriggerType,
    config: Record<string, unknown> | undefined,
  ): string {
    if (!config) return ''
    if (type === 'rating_threshold')
      return String(config.maxRating ?? config.threshold ?? '')
    if (type === 'keyword_match') {
      const k = config.keywords
      if (Array.isArray(k)) return k.join(', ')
      return String(k ?? '')
    }
    if (type === 'aspect_match') return String(config.aspect ?? '')
    return ''
  }

  function handleEdit(rule: EscalationRule) {
    setEditingRule(rule)
    setRuleName(rule.name)
    setTriggerType(rule.triggerType)
    setTriggerValue(readTriggerValueFromConfig(rule.triggerType, rule.triggerConfig))
    setAssignToUserId(rule.assignToUserId ?? '')
    setPriority(rule.priority)
    // Convert minutes (server) → hours (display). Keep an exact integer
    // when possible so round-trips don't drift.
    if (rule.slaMinutes != null) {
      const hours = rule.slaMinutes / 60
      setSlaHoursDisplay(
        Number.isInteger(hours) ? String(hours) : hours.toFixed(1),
      )
    } else {
      setSlaHoursDisplay('')
    }
    setIsActive(rule.isActive)
    setScope((rule.scope ?? 'workspace') as RuleScope)
    setScopeLocationId(rule.locationId ?? '')
    setShowForm(true)
  }

  function handleSubmit() {
    if (!ruleName.trim()) {
      toast.error('Rule name is required')
      return
    }
    if (!currentWorkspaceId) return
    if (scope === 'location' && !scopeLocationId) {
      toast.error('Pick a location for this rule.')
      return
    }

    const slaMinutes = slaHoursDisplay
      ? Math.round(parseFloat(slaHoursDisplay) * 60)
      : undefined

    const payload = {
      workspaceId: currentWorkspaceId,
      name: ruleName.trim(),
      triggerType,
      triggerConfig: buildTriggerConfig(),
      assignToUserId: assignToUserId || undefined,
      priority,
      slaMinutes,
      isActive,
      scope,
      locationId: scope === 'location' ? scopeLocationId : null,
    }

    if (editingRule) {
      updateRule.mutate({ ...payload, ruleId: editingRule.id })
    } else {
      createRule.mutate(payload)
    }
  }

  function handleToggleActive(rule: EscalationRule) {
    if (!currentWorkspaceId) return
    updateRule.mutate({
      ruleId: rule.id,
      workspaceId: currentWorkspaceId,
      isActive: !rule.isActive,
    })
  }

  function handleConfirmDelete() {
    if (!deleteId || !currentWorkspaceId) return
    deleteRule.mutate({ workspaceId: currentWorkspaceId, ruleId: deleteId })
  }

  const triggerLabel = (type: string) =>
    TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type

  const priorityColor = (p: string) =>
    PRIORITY_OPTIONS.find((o) => o.value === p)?.color ?? 'text-muted-foreground'

  const formatTriggerSummary = (rule: EscalationRule): string => {
    const c = rule.triggerConfig as Record<string, unknown> | undefined
    if (!c) return ''
    if (rule.triggerType === 'rating_threshold')
      return `≤ ${c.maxRating ?? c.threshold ?? '?'}`
    if (rule.triggerType === 'keyword_match') {
      const k = c.keywords
      if (Array.isArray(k))
        return k.length <= 2 ? k.join(', ') : `${k[0]}, ${k[1]} +${k.length - 2}`
      return String(k ?? '')
    }
    if (rule.triggerType === 'aspect_match') return String(c.aspect ?? '')
    return ''
  }

  const formatSla = (minutes: number | null | undefined): string => {
    if (minutes == null) return '—'
    if (minutes < 60) return `${minutes}m`
    const hours = minutes / 60
    if (Number.isInteger(hours)) return `${hours}h`
    return `${hours.toFixed(1)}h`
  }

  const deletingRule = rules.find((r) => r.id === deleteId)
  const triggerDef = TRIGGER_TYPES.find((t) => t.value === triggerType)!
  const isPending = createRule.isPending || updateRule.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/escalations">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              Escalation Rules
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure automatic escalation triggers for incoming reviews.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {/* Content */}
      {rulesQuery.isLoading ? (
        <RuleSkeletons />
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Settings className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No escalation rules</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Create rules to automatically escalate reviews that need attention.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const TriggerIcon =
              TRIGGER_TYPES.find((t) => t.value === rule.triggerType)?.icon ??
              Zap
            const ruleScope: RuleScope = (rule.scope ?? 'workspace') as RuleScope
            const scopeLocationName =
              ruleScope === 'location'
                ? locations.find((l) => l.id === rule.locationId)?.name
                : null
            const triggerSummary = formatTriggerSummary(rule)
            return (
              <Card
                key={rule.id}
                className={`transition-all ${
                  !rule.isActive ? 'opacity-60' : 'hover:shadow-md'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <TriggerIcon className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{rule.name}</h3>
                        {!rule.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {triggerLabel(rule.triggerType)}
                          {triggerSummary ? `: ${triggerSummary}` : ''}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${priorityColor(rule.priority)}`}
                        >
                          {rule.priority.charAt(0).toUpperCase() +
                            rule.priority.slice(1)}{' '}
                          Priority
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="size-2.5 mr-1" />
                          SLA: {formatSla(rule.slaMinutes)}
                        </Badge>
                        {rule.assignToUserId && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="size-2.5 mr-1" />
                            Assigned
                          </Badge>
                        )}
                        {/* Phase 2 Stage E — scope badge */}
                        {ruleScope === 'organization' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Building2 className="size-2.5" /> Organization
                          </Badge>
                        )}
                        {ruleScope === 'workspace' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Building className="size-2.5" /> Workspace
                          </Badge>
                        )}
                        {ruleScope === 'location' && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1 text-amber-700 border-amber-300 bg-amber-50"
                          >
                            <MapPin className="size-2.5" />
                            {scopeLocationName ?? 'Location override'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleEdit(rule)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(rule.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Rule Sheet */}
      <Sheet
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            resetForm()
            setShowForm(false)
          }
        }}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingRule ? 'Edit Rule' : 'Create Escalation Rule'}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6 px-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. Low rating escalation"
              />
            </div>

            {/* Trigger type */}
            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select
                value={triggerType}
                onValueChange={(v) => {
                  setTriggerType(v as TriggerType)
                  // Reset trigger value to the default for the new type.
                  const def = TRIGGER_TYPES.find((t) => t.value === v)
                  setTriggerValue(def?.defaultValue ?? '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {triggerDef.description}
              </p>
            </div>

            {/* Trigger value (per type) */}
            {triggerDef.valueType !== 'none' && (
              <div className="space-y-2">
                <Label>{triggerDef.valueLabel}</Label>
                <Input
                  type={triggerDef.valueType === 'number' ? 'number' : 'text'}
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder={triggerDef.defaultValue}
                />
              </div>
            )}

            <Separator />

            {/* Phase 2 Stage E — scope picker */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div>
                <Label>Where this rule applies</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Location rules override workspace; workspace overrides
                  organization. Disabling at a higher scope blocks lower scopes.
                </p>
              </div>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as RuleScope)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">
                    <span className="flex items-center gap-2">
                      <Building2 className="size-4" />
                      Organization (all workspaces)
                    </span>
                  </SelectItem>
                  <SelectItem value="workspace">
                    <span className="flex items-center gap-2">
                      <Building className="size-4" />
                      Workspace (default)
                    </span>
                  </SelectItem>
                  <SelectItem value="location">
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      Specific location
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {scope === 'location' && (
                <Select
                  value={scopeLocationId}
                  onValueChange={setScopeLocationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a location…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No locations in this workspace.
                      </div>
                    ) : (
                      locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SLA */}
            <div className="space-y-2">
              <Label>SLA (hours)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={slaHoursDisplay}
                onChange={(e) => setSlaHoursDisplay(e.target.value)}
                placeholder="24"
              />
              <p className="text-xs text-muted-foreground">
                Time limit to resolve before SLA breach. Stored as minutes
                on the server (24h ⇒ 1440m). Leave blank for no SLA.
              </p>
            </div>

            {/* Assigned to */}
            <div className="space-y-2">
              <Label>Auto-assign to</Label>
              <Select
                value={assignToUserId || 'unassigned'}
                onValueChange={(v) =>
                  setAssignToUserId(v === 'unassigned' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((m) => {
                    const id = m.userId ?? m.id
                    if (!id) return null
                    return (
                      <SelectItem key={id} value={id}>
                        {m.userName ?? m.name ?? m.email ?? 'Unknown'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Enable this rule immediately.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Escalation Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the rule &ldquo;{deletingRule?.name}&rdquo;?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteRule.isPending}
            >
              {deleteRule.isPending && (
                <Loader2 className="size-4 animate-spin mr-1" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
