'use client'

import { useState } from 'react'
import {
  Zap,
  Plus,
  ArrowRight,
  Pencil,
  Trash2,
  Play,
  Pause,
  Mail,
  MessageSquare,
  Ticket,
  AlertTriangle,
  Tag,
  Route,
  Star,
  Clock,
  CheckCircle2,
  ListChecks,
  Loader2,
  Sparkles,
  Building,
  Building2,
  MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { GoogleIcon } from '@/components/ui/platform-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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

// --- Trigger & Action Definitions ---

const triggerEvents = [
  { value: 'journey_completed_positive', label: 'Journey completed (positive)', icon: CheckCircle2 },
  { value: 'journey_completed_negative', label: 'Journey completed (negative)', icon: AlertTriangle },
  { value: 'journey_abandoned', label: 'Journey abandoned', icon: Pause },
  { value: 'review_posted', label: 'New review posted', icon: Star },
  { value: 'review_posted_google', label: 'Review posted on Google', icon: GoogleIcon },
  { value: 'customer_dormant', label: 'Customer dormant', icon: Clock },
  { value: 'custom', label: 'Custom event', icon: Zap },
] as const

const actionTypes = [
  { value: 'send_coupon', label: 'Send coupon', icon: Ticket },
  { value: 'send_message', label: 'Send message', icon: MessageSquare },
  { value: 'create_escalation', label: 'Create escalation', icon: AlertTriangle },
  { value: 'tag_customer', label: 'Tag customer', icon: Tag },
  { value: 'trigger_journey', label: 'Trigger journey', icon: Route },
  { value: 'ai_reply_review', label: 'AI Reply to Review', icon: Sparkles },
] as const

const triggerMap = Object.fromEntries(triggerEvents.map((t) => [t.value, t]))
const actionMap = Object.fromEntries(actionTypes.map((a) => [a.value, a]))

function formatDelay(minutes: number): string {
  if (minutes <= 0) return 'Immediately'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`
  return `${Math.round(minutes / 1440)} day(s)`
}

function RulesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  )
}

export default function AutomationsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)

  // Phase 2 Stage E — top-level scope filter for the rules list.
  const [scopeFilter, setScopeFilter] = useState<'all' | 'organization' | 'workspace' | 'location'>('all')

  // Form state
  const [name, setName] = useState('')
  const [triggerEvent, setTriggerEvent] = useState<string>('review_posted')
  const [actionType, setActionType] = useState<string>('send_coupon')
  const [delayMinutes, setDelayMinutes] = useState('0')
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const [isActive, setIsActive] = useState(true)
  // Phase 2 Stage E — scope on the rule being edited.
  const [scope, setScope] = useState<'organization' | 'workspace' | 'location'>('workspace')
  const [scopeLocationId, setScopeLocationId] = useState<string>('')
  // Action config fields
  const [templateName, setTemplateName] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [tagName, setTagName] = useState('')
  // AI Reply to Review config
  const [aiReplyRatingFilter, setAiReplyRatingFilter] = useState<string>('all')
  const [aiReplyTone, setAiReplyTone] = useState<string>('professional')
  const [aiReplyIncludeBusinessName, setAiReplyIncludeBusinessName] = useState(true)
  const [aiReplyMaxLength, setAiReplyMaxLength] = useState<string>('medium')

  const rulesQuery = trpc.automation.listRules.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      membershipId: currentWorkspaceId!,
    },
    { enabled: !!currentWorkspaceId }
  )

  // Phase 2 Stage E — locations needed for the per-location scope picker
  // and for showing "Override at: <location>" labels on rule cards.
  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )
  const locations = (locationsQuery.data ?? []) as Array<{
    id: string
    name: string
  }>

  const statsQuery = trpc.automation.getStats.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      membershipId: currentWorkspaceId!,
    },
    { enabled: !!currentWorkspaceId }
  )

  const createMutation = trpc.automation.createRule.useMutation({
    onSuccess: () => {
      toast.success('Automation rule created')
      setCreateOpen(false)
      resetForm()
      utils.automation.listRules.invalidate()
      utils.automation.getStats.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create rule')
    },
  })

  const updateMutation = trpc.automation.updateRule.useMutation({
    onSuccess: () => {
      toast.success('Rule updated')
      setEditingRule(null)
      setCreateOpen(false)
      resetForm()
      utils.automation.listRules.invalidate()
      utils.automation.getStats.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update rule')
    },
  })

  const deleteMutation = trpc.automation.deleteRule.useMutation({
    onSuccess: () => {
      toast.success('Rule deleted')
      utils.automation.listRules.invalidate()
      utils.automation.getStats.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete rule')
    },
  })

  const toggleMutation = trpc.automation.updateRule.useMutation({
    onSuccess: () => {
      utils.automation.listRules.invalidate()
      utils.automation.getStats.invalidate()
    },
  })

  function resetForm() {
    setName('')
    setTriggerEvent('review_posted')
    setActionType('send_coupon')
    setDelayMinutes('0')
    setDelayUnit('minutes')
    setIsActive(true)
    setScope('workspace')
    setScopeLocationId('')
    setTemplateName('')
    setMessageContent('')
    setTagName('')
    setAiReplyRatingFilter('all')
    setAiReplyTone('professional')
    setAiReplyIncludeBusinessName(true)
    setAiReplyMaxLength('medium')
  }

  function openEdit(rule: any) {
    setEditingRule(rule)
    setName(rule.name)
    setTriggerEvent(rule.triggerEvent)
    setActionType(rule.actionType)
    // Convert delay minutes to best unit
    const dm = rule.delayMinutes ?? 0
    if (dm >= 1440 && dm % 1440 === 0) {
      setDelayMinutes(String(dm / 1440))
      setDelayUnit('days')
    } else if (dm >= 60 && dm % 60 === 0) {
      setDelayMinutes(String(dm / 60))
      setDelayUnit('hours')
    } else {
      setDelayMinutes(String(dm))
      setDelayUnit('minutes')
    }
    setIsActive(rule.isActive ?? true)
    setScope((rule.scope as any) ?? 'workspace')
    setScopeLocationId(rule.locationId ?? '')
    setTemplateName(rule.actionConfig?.templateName ?? '')
    setMessageContent(rule.actionConfig?.message ?? '')
    setTagName(rule.actionConfig?.tagName ?? '')
    setAiReplyRatingFilter(rule.actionConfig?.ratingFilter ?? 'all')
    setAiReplyTone(rule.actionConfig?.tone ?? 'professional')
    setAiReplyIncludeBusinessName(rule.actionConfig?.includeBusinessName ?? true)
    setAiReplyMaxLength(rule.actionConfig?.maxLength ?? 'medium')
    setCreateOpen(true)
  }

  function getDelayInMinutes(): number {
    const val = parseInt(delayMinutes) || 0
    if (delayUnit === 'hours') return val * 60
    if (delayUnit === 'days') return val * 1440
    return val
  }

  function buildActionConfig(): Record<string, unknown> {
    switch (actionType) {
      case 'send_coupon':
        return templateName ? { templateName } : {}
      case 'send_message':
        return messageContent ? { message: messageContent } : {}
      case 'tag_customer':
        return tagName ? { tagName } : {}
      case 'ai_reply_review':
        return {
          ratingFilter: aiReplyRatingFilter,
          tone: aiReplyTone,
          includeBusinessName: aiReplyIncludeBusinessName,
          maxLength: aiReplyMaxLength,
        }
      default:
        return {}
    }
  }

  function handleSave() {
    if (!name.trim() || !currentWorkspaceId) return

    if (scope === 'location' && !scopeLocationId) {
      toast.error('Pick a location for this rule.')
      return
    }

    const payload = {
      workspaceId: currentWorkspaceId,
      membershipId: currentWorkspaceId,
      name: name.trim(),
      triggerEvent: triggerEvent as any,
      actionType: actionType as any,
      delayMinutes: getDelayInMinutes(),
      actionConfig: buildActionConfig(),
      isActive,
      // Phase 2 Stage E — scope. Server fills organizationId from the
      // workspace when scope='organization', so we only send locationId.
      scope,
      locationId: scope === 'location' ? scopeLocationId : null,
    }

    if (editingRule) {
      updateMutation.mutate({
        ...payload,
        ruleId: editingRule.id,
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(ruleId: string) {
    if (!currentWorkspaceId) return
    deleteMutation.mutate({
      workspaceId: currentWorkspaceId,
      membershipId: currentWorkspaceId,
      ruleId,
    })
  }

  function handleToggle(rule: any) {
    if (!currentWorkspaceId) return
    toggleMutation.mutate({
      workspaceId: currentWorkspaceId,
      membershipId: currentWorkspaceId,
      ruleId: rule.id,
      isActive: !rule.isActive,
    })
  }

  const rules = (rulesQuery.data as any) ?? []
  const stats = (statsQuery.data as any) ?? null
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post-Review Actions</h1>
          <p className="text-sm text-muted-foreground">
            Create rules to automate post-review follow-ups, escalations, and more.
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) {
              setEditingRule(null)
              resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </DialogTitle>
              <DialogDescription>
                Define a trigger, an action, and an optional delay.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  placeholder='e.g. "Send coupon after negative review"'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Trigger */}
              <div className="space-y-2">
                <Label>When (Trigger)</Label>
                <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerEvents.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action */}
              <div className="space-y-2">
                <Label>Then (Action)</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action config */}
              {actionType === 'send_coupon' && (
                <div className="space-y-2">
                  <Label htmlFor="template-name">Coupon Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g. 10% Off"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
              )}
              {actionType === 'send_message' && (
                <div className="space-y-2">
                  <Label htmlFor="message-content">Message</Label>
                  <Input
                    id="message-content"
                    placeholder="e.g. Thank you for your feedback!"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                  />
                </div>
              )}
              {actionType === 'tag_customer' && (
                <div className="space-y-2">
                  <Label htmlFor="tag-name">Tag Name</Label>
                  <Input
                    id="tag-name"
                    placeholder="e.g. at-risk"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                  />
                </div>
              )}
              {actionType === 'ai_reply_review' && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">AI Reply Configuration</p>
                  <div className="space-y-2">
                    <Label>Rating Filter</Label>
                    <Select value={aiReplyRatingFilter} onValueChange={setAiReplyRatingFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All ratings</SelectItem>
                        <SelectItem value="positive">Positive only (4-5 stars)</SelectItem>
                        <SelectItem value="negative">Negative only (1-3 stars)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select value={aiReplyTone} onValueChange={setAiReplyTone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-biz-name" className="text-sm">
                      Include business name
                    </Label>
                    <Switch
                      id="include-biz-name"
                      checked={aiReplyIncludeBusinessName}
                      onCheckedChange={setAiReplyIncludeBusinessName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Response Length</Label>
                    <Select value={aiReplyMaxLength} onValueChange={setAiReplyMaxLength}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (~50 words)</SelectItem>
                        <SelectItem value="medium">Medium (~100 words)</SelectItem>
                        <SelectItem value="long">Long (~150 words)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Delay */}
              <div className="space-y-2">
                <Label>Delay</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(e.target.value)}
                    className="w-24"
                  />
                  <Select
                    value={delayUnit}
                    onValueChange={(v) => setDelayUnit(v as any)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Phase 2 Stage E — scope picker */}
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div>
                  <Label>Where this rule applies</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Location rules override workspace; workspace rules override
                    organization. Disabling at a higher scope blocks lower
                    scopes.
                  </p>
                </div>
                <Select
                  value={scope}
                  onValueChange={(v) => setScope(v as typeof scope)}
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

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="rule-active" className="text-sm">
                  Enable rule immediately
                </Label>
                <Switch
                  id="rule-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false)
                  setEditingRule(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : editingRule ? (
                  'Update Rule'
                ) : (
                  'Create Rule'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Rules</CardDescription>
              <CardTitle className="text-2xl">
                {stats.totalRules ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Rules</CardDescription>
              <CardTitle className="text-2xl">
                {stats.activeRules ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Queued Actions</CardDescription>
              <CardTitle className="text-2xl">
                {stats.queuedActions ?? stats.pendingActions ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed Actions</CardDescription>
              <CardTitle className="text-2xl">
                {stats.completedActions ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/*
        Phase 2 Stage E — scope filter tabs.
        Counts shown in parentheses for each scope.
      */}
      {Array.isArray(rules) && rules.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm">
          {([
            { value: 'all', label: 'All scopes' },
            { value: 'organization', label: 'Organization' },
            { value: 'workspace', label: 'Workspace' },
            { value: 'location', label: 'Per-location' },
          ] as const).map((tab) => {
            const count =
              tab.value === 'all'
                ? rules.length
                : rules.filter(
                    (r: any) => (r.scope ?? 'workspace') === tab.value,
                  ).length
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setScopeFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  scopeFilter === tab.value
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-muted-foreground">({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Rules list */}
      {rulesQuery.isLoading ? (
        <RulesSkeleton />
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Zap className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            No post-review action rules yet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Create your first rule to automate post-review follow-ups.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create Rule
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(Array.isArray(rules) ? rules : [])
            .filter((rule: any) =>
              scopeFilter === 'all'
                ? true
                : (rule.scope ?? 'workspace') === scopeFilter,
            )
            .map((rule: any) => {
            const trigger = triggerMap[rule.triggerEvent]
            const action = actionMap[rule.actionType]
            const TriggerIcon = trigger?.icon ?? Zap
            const ActionIcon = action?.icon ?? Zap
            const ruleScope = (rule.scope ?? 'workspace') as
              | 'organization'
              | 'workspace'
              | 'location'
            const scopeLocationName =
              ruleScope === 'location'
                ? locations.find((l) => l.id === rule.locationId)?.name
                : null
            return (
              <Card
                key={rule.id}
                className={`transition-shadow hover:shadow-md ${!rule.isActive ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate pr-2">
                      {rule.name}
                    </CardTitle>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => handleToggle(rule)}
                      aria-label="Toggle rule"
                    />
                  </div>
                  {/* Phase 2 Stage E — scope badge */}
                  <div className="mt-1 flex items-center gap-1.5">
                    {ruleScope === 'organization' && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Building2 className="size-3" /> Organization
                      </Badge>
                    )}
                    {ruleScope === 'workspace' && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Building className="size-3" /> Workspace
                      </Badge>
                    )}
                    {ruleScope === 'location' && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                      >
                        <MapPin className="size-3" />
                        {scopeLocationName ?? 'Location override'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Trigger -> Action flow */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                      <TriggerIcon className="h-3.5 w-3.5" />
                      {trigger?.label ?? rule.triggerEvent}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1.5 rounded-md bg-green-50 dark:bg-green-950/30 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-300">
                      <ActionIcon className="h-3.5 w-3.5" />
                      {action?.label ?? rule.actionType}
                    </div>
                  </div>

                  {/* Delay info */}
                  {(rule.delayMinutes ?? 0) > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Delay: {formatDelay(rule.delayMinutes)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
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
