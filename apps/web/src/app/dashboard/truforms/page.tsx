'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Plus,
  MoreVertical,
  Play,
  Archive,
  Trash2,
  ClipboardList,
  QrCode,
  Copy,
  Download,
  Eye,
  Pencil,
  ExternalLink,
  Star,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

type FilterTab = 'all' | 'nps' | 'csat' | 'ces' | 'custom'

function TruFormsSkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </Card>
      ))}
    </div>
  )
}

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
            Share this QR code to collect feedback from your customers.
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
                <SelectItem value="1024">1024px</SelectItem>
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
            Download QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function TruFormsPage() {
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [createOpen, setCreateOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'nps' | 'csat' | 'ces' | 'custom'>('nps')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [qrForm, setQrForm] = useState<{ id: string; slug: string } | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const formsQuery = trpc.truform.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const createMutation = trpc.truform.create.useMutation({
    onSuccess: (data) => {
      toast.success('Form created')
      setCreateOpen(false)
      setFormName('')
      setFormType('nps')
      utils.truform.list.invalidate()
      router.push(`/dashboard/truforms/${data.id}`)
    },
    onError: (error) => toast.error(error.message || 'Failed to create form'),
  })

  const activateMutation = trpc.truform.activate.useMutation({
    onSuccess: () => {
      toast.success('Form activated')
      utils.truform.list.invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to activate'),
  })

  const archiveMutation = trpc.truform.archive.useMutation({
    onSuccess: () => {
      toast.success('Form archived')
      utils.truform.list.invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to archive'),
  })

  const deleteMutation = trpc.truform.delete.useMutation({
    onSuccess: () => {
      toast.success('Form deleted')
      setDeleteId(null)
      utils.truform.list.invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to delete'),
  })

  const allForms = formsQuery.data ?? []
  const forms = activeFilter === 'all'
    ? allForms
    : allForms.filter((f: any) => f.type === activeFilter)

  const filterTabs: { label: string; value: FilterTab; count: number }[] = [
    { label: 'All', value: 'all', count: allForms.length },
    { label: 'NPS', value: 'nps', count: allForms.filter((f: any) => f.type === 'nps').length },
    { label: 'CSAT', value: 'csat', count: allForms.filter((f: any) => f.type === 'csat').length },
    { label: 'CES', value: 'ces', count: allForms.filter((f: any) => f.type === 'ces').length },
    { label: 'Custom', value: 'custom', count: allForms.filter((f: any) => f.type === 'custom').length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TruForms</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage feedback forms for your customers.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create Form
        </Button>
      </div>

      {/* Filter Tabs */}
      {allForms.length > 0 && (
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeFilter === tab.value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {formsQuery.isLoading ? (
        <TruFormsSkeletons />
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {activeFilter !== 'all' ? `No ${activeFilter.toUpperCase()} forms` : 'No forms yet'}
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {activeFilter !== 'all'
              ? `Create a ${activeFilter.toUpperCase()} form to start collecting feedback.`
              : 'Create your first feedback form to start collecting customer insights.'}
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create Form
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form: any) => (
            <Card
              key={form.id}
              className="group cursor-pointer p-5 transition-all hover:shadow-md hover:bg-muted/30"
              onClick={() => router.push(`/dashboard/truforms/${form.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{form.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      className={`text-xs ${typeColors[form.type] ?? typeColors.custom}`}
                      variant="secondary"
                    >
                      {form.type?.toUpperCase()}
                    </Badge>
                    <Badge
                      className={`text-xs ${statusColors[form.status] ?? statusColors.draft}`}
                      variant="secondary"
                    >
                      {form.status}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/truforms/${form.id}`)
                      }}
                    >
                      <Pencil className="size-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`/f/${form.slug ?? form.id}`, '_blank')
                      }}
                    >
                      <Eye className="size-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        setQrForm({ id: form.id, slug: form.slug ?? form.id })
                      }}
                    >
                      <QrCode className="size-4 mr-2" />
                      QR Code
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {form.status !== 'active' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          activateMutation.mutate({ id: form.id })
                        }}
                      >
                        <Play className="size-4 mr-2" />
                        Activate
                      </DropdownMenuItem>
                    )}
                    {form.status !== 'archived' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          archiveMutation.mutate({ id: form.id })
                        }}
                      >
                        <Archive className="size-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(form.id)
                      }}
                    >
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <ClipboardList className="size-3" />
                    Responses
                  </div>
                  <p className="text-sm font-semibold mt-0.5">
                    {form.responseCount ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Star className="size-3" />
                    Avg Score
                  </div>
                  <p className="text-sm font-semibold mt-0.5">
                    {form.averageScore != null
                      ? Number(form.averageScore).toFixed(1)
                      : '--'}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Created {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ''}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Form</DialogTitle>
            <DialogDescription>
              Choose a form type and give it a name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Form Name</Label>
              <Input
                placeholder="e.g. Post-Visit Feedback"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formName.trim()) {
                    createMutation.mutate({
                      workspaceId: currentWorkspaceId!,
                      name: formName,
                      type: formType,
                    })
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Survey Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'nps' as const, label: 'NPS', desc: 'Net Promoter Score (0-10)' },
                  { value: 'csat' as const, label: 'CSAT', desc: 'Customer Satisfaction (1-5)' },
                  { value: 'ces' as const, label: 'CES', desc: 'Customer Effort Score (1-7)' },
                  { value: 'custom' as const, label: 'Custom', desc: 'Build your own questions' },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFormType(type.value)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                      formType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Badge className={`text-xs mb-1 ${typeColors[type.value]}`} variant="secondary">
                      {type.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  workspaceId: currentWorkspaceId!,
                  name: formName,
                  type: formType,
                })
              }
              disabled={!formName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this form? All responses will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteId) deleteMutation.mutate({ id: deleteId }) }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      {qrForm && (
        <QrCodeDialog
          open={!!qrForm}
          onOpenChange={(open) => { if (!open) setQrForm(null) }}
          formSlug={qrForm.slug}
          formId={qrForm.id}
        />
      )}
    </div>
  )
}
