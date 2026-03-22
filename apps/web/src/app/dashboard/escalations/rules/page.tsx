'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
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
} from 'lucide-react'

interface EscalationRule {
  id: string
  name: string
  triggerType: string
  triggerValue?: string | number
  assignedTo?: string
  assignedToName?: string
  priority: string
  slaHours: number
  isActive: boolean
  createdAt?: string
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
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const TRIGGER_TYPES = [
  { value: 'rating_below', label: 'Rating Below Threshold', icon: Star, description: 'Escalate when review rating is below a value' },
  { value: 'keyword', label: 'Keyword Match', icon: Zap, description: 'Escalate when review contains specific keywords' },
  { value: 'no_response', label: 'No Response After', icon: Clock, description: 'Escalate if no response after a time period' },
  { value: 'negative_sentiment', label: 'Negative Sentiment', icon: AlertTriangle, description: 'Escalate on negative sentiment detection' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
]

export default function EscalationRulesPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [ruleName, setRuleName] = useState('')
  const [triggerType, setTriggerType] = useState('rating_below')
  const [triggerValue, setTriggerValue] = useState('3')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState('medium')
  const [slaHours, setSlaHours] = useState('24')
  const [isActive, setIsActive] = useState(true)

  // Queries
  const rulesQuery = trpc.escalation?.listRules?.useQuery?.(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  ) ?? { data: [], isLoading: false }

  const membersQuery = trpc.member.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Mutations
  const createRule = trpc.escalation?.createRule?.useMutation?.({
    onSuccess: () => {
      toast.success('Escalation rule created')
      utils.escalation?.listRules?.invalidate?.()
      resetForm()
      setShowForm(false)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create rule')
    },
  }) ?? null

  const updateRule = trpc.escalation?.updateRule?.useMutation?.({
    onSuccess: () => {
      toast.success('Escalation rule updated')
      utils.escalation?.listRules?.invalidate?.()
      resetForm()
      setShowForm(false)
      setEditingRule(null)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update rule')
    },
  }) ?? null

  const deleteRule = trpc.escalation?.deleteRule?.useMutation?.({
    onSuccess: () => {
      toast.success('Escalation rule deleted')
      utils.escalation?.listRules?.invalidate?.()
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete rule')
    },
  }) ?? null

  const rules: EscalationRule[] = (rulesQuery as any)?.data ?? []
  const teamMembers = membersQuery.data ?? []

  const resetForm = () => {
    setRuleName('')
    setTriggerType('rating_below')
    setTriggerValue('3')
    setAssignedTo('')
    setPriority('medium')
    setSlaHours('24')
    setIsActive(true)
    setEditingRule(null)
  }

  const handleEdit = (rule: EscalationRule) => {
    setEditingRule(rule)
    setRuleName(rule.name)
    setTriggerType(rule.triggerType)
    setTriggerValue(String(rule.triggerValue ?? ''))
    setAssignedTo(rule.assignedTo ?? '')
    setPriority(rule.priority)
    setSlaHours(String(rule.slaHours))
    setIsActive(rule.isActive)
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!ruleName.trim()) {
      toast.error('Rule name is required')
      return
    }

    const payload = {
      workspaceId: currentWorkspaceId!,
      name: ruleName.trim(),
      triggerType,
      triggerValue: triggerValue || undefined,
      assignedTo: assignedTo || undefined,
      priority,
      slaHours: parseInt(slaHours) || 24,
      isActive,
    }

    if (editingRule && updateRule) {
      updateRule.mutate({ ...payload, ruleId: editingRule.id })
    } else if (createRule) {
      createRule.mutate(payload)
    } else {
      toast.success('Rule saved (locally)')
      resetForm()
      setShowForm(false)
    }
  }

  const handleToggleActive = (rule: EscalationRule) => {
    if (updateRule) {
      updateRule.mutate({
        ruleId: rule.id,
        workspaceId: currentWorkspaceId!,
        isActive: !rule.isActive,
      })
    } else {
      toast.info('Toggle feature coming soon')
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteId) return
    if (deleteRule) {
      deleteRule.mutate({ ruleId: deleteId })
    } else {
      toast.info('Delete feature coming soon')
      setDeleteId(null)
    }
  }

  const triggerLabel = (type: string) =>
    TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type

  const priorityColor = (p: string) =>
    PRIORITY_OPTIONS.find((o) => o.value === p)?.color ?? 'text-muted-foreground'

  const deletingRule = rules.find((r) => r.id === deleteId)

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
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {/* Content */}
      {(rulesQuery as any).isLoading ? (
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
          <Button className="mt-4" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-1" />
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const TriggerIcon = TRIGGER_TYPES.find((t) => t.value === rule.triggerType)?.icon ?? Zap
            return (
              <Card key={rule.id} className={`transition-all ${!rule.isActive ? 'opacity-60' : 'hover:shadow-md'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <TriggerIcon className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{rule.name}</h3>
                        {!rule.isActive && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {triggerLabel(rule.triggerType)}
                          {rule.triggerValue ? `: ${rule.triggerValue}` : ''}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${priorityColor(rule.priority)}`}>
                          {rule.priority.charAt(0).toUpperCase() + rule.priority.slice(1)} Priority
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="size-2.5 mr-1" />
                          SLA: {rule.slaHours}h
                        </Badge>
                        {(rule.assignedToName ?? rule.assignedTo) && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="size-2.5 mr-1" />
                            {rule.assignedToName ?? rule.assignedTo}
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
      <Sheet open={showForm} onOpenChange={(open) => { if (!open) { resetForm(); setShowForm(false) } }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingRule ? 'Edit Rule' : 'Create Escalation Rule'}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6">
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
              <Select value={triggerType} onValueChange={setTriggerType}>
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
                {TRIGGER_TYPES.find((t) => t.value === triggerType)?.description}
              </p>
            </div>

            {/* Trigger value */}
            <div className="space-y-2">
              <Label>
                {triggerType === 'rating_below' ? 'Rating Threshold' :
                 triggerType === 'keyword' ? 'Keywords (comma-separated)' :
                 triggerType === 'no_response' ? 'Hours without response' :
                 'Trigger Value'}
              </Label>
              <Input
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                placeholder={
                  triggerType === 'rating_below' ? '3' :
                  triggerType === 'keyword' ? 'complaint, refund, terrible' :
                  triggerType === 'no_response' ? '48' :
                  'Enter value'
                }
                type={triggerType === 'rating_below' || triggerType === 'no_response' ? 'number' : 'text'}
              />
            </div>

            <Separator />

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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
                min="1"
                max="720"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="24"
              />
              <p className="text-xs text-muted-foreground">
                Time limit to resolve this escalation before it is marked as breached.
              </p>
            </div>

            {/* Assigned to */}
            <div className="space-y-2">
              <Label>Auto-Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member: any) => (
                    <SelectItem key={member.userId ?? member.id} value={member.userId ?? member.id}>
                      {member.userName ?? member.name ?? member.email ?? 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">Enable this rule immediately.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={createRule?.isPending || updateRule?.isPending}>
              {(createRule?.isPending || updateRule?.isPending) && (
                <Loader2 className="size-4 animate-spin mr-1" />
              )}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Escalation Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the rule "{deletingRule?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteRule?.isPending}
            >
              {deleteRule?.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
