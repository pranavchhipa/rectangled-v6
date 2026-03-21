'use client'

import { useState } from 'react'
import {
  Ticket,
  Plus,
  Percent,
  DollarSign,
  Gift,
  Calendar,
  BarChart3,
  Sparkles,
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

function TemplateSkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

const discountTypeIcon = {
  percentage: Percent,
  flat: DollarSign,
  freebie: Gift,
}

const discountTypeLabel = {
  percentage: 'Percentage Off',
  flat: 'Flat Discount',
  freebie: 'Freebie',
}

export default function CouponsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerated, setAiGenerated] = useState<any>(null)

  // Form state
  const [name, setName] = useState('')
  const [codePrefix, setCodePrefix] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'flat' | 'freebie'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [validityDays, setValidityDays] = useState('30')
  const [description, setDescription] = useState('')

  const templatesQuery = trpc.coupon.listTemplates.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const statsQuery = trpc.coupon.stats.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const couponsQuery = trpc.coupon.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      templateId: selectedTemplateId ?? undefined,
      page: 1,
      limit: 50,
    },
    { enabled: !!currentWorkspaceId && !!selectedTemplateId }
  )

  const createMutation = trpc.coupon.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template created')
      setCreateOpen(false)
      resetForm()
      utils.coupon.listTemplates.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create template')
    },
  })

  const aiGenerateMutation = trpc.coupon?.generateWithAi?.useMutation?.({
    onSuccess: (data: any) => {
      setAiGenerated(data)
      toast.success('AI generated coupon details!')
    },
    onError: (err: any) => toast.error(err?.message || 'AI generation failed'),
  })

  const deleteTemplateMutation = trpc.coupon.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template deactivated')
      utils.coupon.listTemplates.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to deactivate template')
    },
  })

  function resetForm() {
    setName('')
    setCodePrefix('')
    setDiscountType('percentage')
    setDiscountValue('')
    setValidityDays('30')
    setDescription('')
  }

  function handleCreate() {
    if (!name.trim() || !codePrefix.trim() || !currentWorkspaceId) return
    createMutation.mutate({
      workspaceId: currentWorkspaceId,
      name: name.trim(),
      codePrefix: codePrefix.trim(),
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      validityDays: parseInt(validityDays) || 30,
      description: description || undefined,
    })
  }

  function formatDiscount(type: string, value: number) {
    if (type === 'percentage') return `${value}% off`
    if (type === 'flat') return `$${value} off`
    return 'Freebie'
  }

  const templates = templatesQuery.data ?? []
  const stats = statsQuery.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupon Engine</h1>
          <p className="text-sm text-muted-foreground">
            Create coupon templates and manage issued coupons.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="size-4" />
            AI Create
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Create Template
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Coupon Template</DialogTitle>
              <DialogDescription>
                Define a reusable coupon template. You can issue individual coupons from it later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder='e.g. "10% Off Next Visit"'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code-prefix">Code Prefix</Label>
                <Input
                  id="code-prefix"
                  placeholder="e.g. SAVE10"
                  value={codePrefix}
                  onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                  maxLength={20}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                      <SelectItem value="freebie">Freebie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount-value">Discount Value</Label>
                  <Input
                    id="discount-value"
                    type="number"
                    placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 5.00'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={discountType === 'freebie'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="validity-days">Validity (days)</Label>
                <Input
                  id="validity-days"
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this coupon"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || !codePrefix.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* AI Create Dialog */}
      <Dialog open={aiOpen} onOpenChange={(open) => { setAiOpen(open); if (!open) { setAiGenerated(null); setAiPrompt(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI Coupon Creator
            </DialogTitle>
            <DialogDescription>
              Describe the coupon you want and AI will generate the details for you.
            </DialogDescription>
          </DialogHeader>

          {!aiGenerated ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Describe your coupon</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g., Create a 15% off coupon for first-time dine-in customers at my restaurant, valid for 2 weeks"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (!currentWorkspaceId || !aiPrompt.trim()) return
                  aiGenerateMutation?.mutate?.({ workspaceId: currentWorkspaceId, prompt: aiPrompt.trim() })
                }}
                disabled={!aiPrompt.trim() || aiGenerateMutation?.isPending}
              >
                {aiGenerateMutation?.isPending ? (
                  <><Loader2 className="size-4 animate-spin mr-1" /> Generating...</>
                ) : (
                  <><Sparkles className="size-4 mr-1" /> Generate Coupon</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Edit the generated details below, then create the coupon.</p>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={aiGenerated.name ?? ''} onChange={(e) => setAiGenerated({ ...aiGenerated, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code Prefix</Label>
                <Input value={aiGenerated.codePrefix ?? ''} onChange={(e) => setAiGenerated({ ...aiGenerated, codePrefix: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={aiGenerated.discountType ?? 'percentage'} onValueChange={(v) => setAiGenerated({ ...aiGenerated, discountType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat (INR)</SelectItem>
                      <SelectItem value="freebie">Freebie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input type="number" value={aiGenerated.discountValue ?? ''} onChange={(e) => setAiGenerated({ ...aiGenerated, discountValue: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Validity (days)</Label>
                <Input type="number" value={aiGenerated.validityDays ?? 30} onChange={(e) => setAiGenerated({ ...aiGenerated, validityDays: Number(e.target.value) })} />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAiGenerated(null)}>Back</Button>
                <Button onClick={() => {
                  if (!currentWorkspaceId) return
                  createMutation.mutate({
                    workspaceId: currentWorkspaceId,
                    name: aiGenerated.name,
                    codePrefix: aiGenerated.codePrefix,
                    discountType: aiGenerated.discountType,
                    discountValue: Number(aiGenerated.discountValue),
                    validityDays: Number(aiGenerated.validityDays),
                  })
                  setAiOpen(false)
                  setAiGenerated(null)
                  setAiPrompt('')
                }}>
                  Apply & Create
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stats overview */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Issued</CardDescription>
              <CardTitle className="text-2xl">{stats.totalIssued}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Redeemed</CardDescription>
              <CardTitle className="text-2xl">{stats.totalRedeemed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Redemption Rate</CardDescription>
              <CardTitle className="text-2xl">{stats.redemptionRate}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Templates */}
      {templatesQuery.isLoading ? (
        <TemplateSkeletons />
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Ticket className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No coupon templates yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Create your first coupon template to start issuing coupons to customers.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: any) => {
            const Icon = discountTypeIcon[template.discountType as keyof typeof discountTypeIcon] || Percent
            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${selectedTemplateId === template.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() =>
                  setSelectedTemplateId(
                    selectedTemplateId === template.id ? null : template.id
                  )
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate pr-2">
                      {template.name}
                    </CardTitle>
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {template.codePrefix}-XXXXXX
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="font-medium">
                      {formatDiscount(template.discountType, template.discountValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      <span>{template.validityDays}d validity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="size-3.5" />
                      <span>
                        {template.maxRedemptions
                          ? `Max ${template.maxRedemptions}`
                          : 'Unlimited'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end mt-4 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (currentWorkspaceId) {
                          deleteTemplateMutation.mutate({
                            workspaceId: currentWorkspaceId,
                            templateId: template.id,
                          })
                        }
                      }}
                    >
                      Deactivate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Issued coupons for selected template */}
      {selectedTemplateId && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Issued Coupons</h2>
          {couponsQuery.isLoading ? (
            <TemplateSkeletons />
          ) : (couponsQuery.data?.items?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No coupons issued for this template yet.
            </p>
          ) : (
            <div className="rounded-xl border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Customer</th>
                      <th className="text-left p-3 font-medium">Issued</th>
                      <th className="text-left p-3 font-medium">Expires</th>
                      <th className="text-left p-3 font-medium">Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couponsQuery.data?.items.map((coupon: any) => (
                      <tr key={coupon.id} className="border-b last:border-0">
                        <td className="p-3 font-mono text-xs">
                          {coupon.uniqueCode}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              coupon.status === 'redeemed'
                                ? 'default'
                                : coupon.status === 'issued'
                                  ? 'outline'
                                  : 'secondary'
                            }
                          >
                            {coupon.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {coupon.customer?.name ?? 'N/A'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(coupon.issuedAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(coupon.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{coupon.deliveryMethod}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
