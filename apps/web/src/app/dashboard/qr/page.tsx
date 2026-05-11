'use client'

import { useMemo, useState } from 'react'
import {
  QrCode as QrCodeIcon,
  Plus,
  Copy,
  Download,
  Archive,
  Loader2,
  Search,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * QR Code Management System.
 *
 * Every QR generated within the current workspace, with click counts,
 * downloads, and copy-link. New QRs are created from the "+ Create QR"
 * dialog (pick journey/form, set a purpose label).
 *
 * Each row's trackable URL routes through /q/{shortCode}, which is
 * served by apps/web/src/app/q/[shortCode]/route.ts — that handler
 * records the scan + 302-redirects to the journey/form public page.
 */
export default function QrCodesPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>(
    'active',
  )
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const listQuery = trpc.qr.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    { enabled: !!currentWorkspaceId },
  )

  const archiveMutation = trpc.qr.archive.useMutation({
    onSuccess: () => {
      utils.qr.list.invalidate()
      toast.success('QR archived')
    },
    onError: (e) => toast.error(e.message),
  })

  const downloadMutation = trpc.qr.download.useMutation({
    onError: (e) => toast.error(e.message),
  })

  const rows = listQuery.data ?? []
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.label?.toLowerCase().includes(q) ||
        r.shortCode.toLowerCase().includes(q) ||
        r.targetName?.toLowerCase().includes(q),
    )
  }, [rows, search])

  async function handleCopyLink(trackingUrl: string) {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy — try selecting and copying manually')
    }
  }

  async function handleDownload(id: string, format: 'png' | 'svg') {
    const result = await downloadMutation.mutateAsync({
      id,
      format,
      size: 600,
    })
    // PNG: `data` is a data URL. SVG: `data` is the raw <svg> string.
    if (format === 'png') {
      triggerDownload(result.data, `qr-${result.shortCode}.png`)
    } else {
      const blob = new Blob([result.data], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, `qr-${result.shortCode}.svg`)
      // Defer revoke so the browser has time to fetch the anchor target.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const totalClicks = rows.reduce((sum, r) => sum + r.clickCount, 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <QrCodeIcon className="size-6" />
            QR Codes
          </h1>
          <p className="text-sm text-muted-foreground">
            Every QR code generated in this workspace. Each scan is tracked
            against the row's click counter.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create QR
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total QRs
          </p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active
          </p>
          <p className="mt-1 text-2xl font-bold">
            {rows.filter((r) => r.status === 'active').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total scans
          </p>
          <p className="mt-1 text-2xl font-bold">{totalClicks.toLocaleString()}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label, code, or target…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as 'active' | 'archived' | 'all')
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label / Purpose</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Tracking link</TableHead>
              <TableHead className="text-right">Scans</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}

            {!listQuery.isLoading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <QrCodeIcon className="size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No QR codes yet</p>
                    <p className="text-xs text-muted-foreground">
                      Create a QR for any journey or truform — each scan
                      will land on that survey and increment the counter
                      here.
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      Create your first QR
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-[200px]">
                  <p className="font-medium">
                    {row.label || (
                      <span className="text-muted-foreground italic">
                        Untitled
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {row.shortCode}
                  </code>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="truncate text-sm">
                    {row.targetName ?? <span className="text-muted-foreground italic">Deleted survey</span>}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {row.targetType === 'journey' ? 'Journey' : 'TruForm'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <code className="max-w-[200px] truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                      {row.trackingUrl.replace(/^https?:\/\//, '')}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => handleCopyLink(row.trackingUrl)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <a
                      href={row.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="icon" variant="ghost" className="size-7">
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </a>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {row.clickCount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.status === 'active' ? 'default' : 'secondary'}
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Download className="size-3.5" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDownload(row.id, 'png')}
                      >
                        <Download className="size-3.5" />
                        Download PNG
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDownload(row.id, 'svg')}
                      >
                        <Download className="size-3.5" />
                        Download SVG
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCopyLink(row.trackingUrl)}
                      >
                        <Copy className="size-3.5" />
                        Copy tracking link
                      </DropdownMenuItem>
                      {row.status === 'active' && (
                        <DropdownMenuItem
                          onClick={() => archiveMutation.mutate({ id: row.id })}
                          className="text-destructive"
                        >
                          <Archive className="size-3.5" />
                          Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateQrDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={currentWorkspaceId ?? ''}
        onCreated={() => {
          utils.qr.list.invalidate()
          setCreateOpen(false)
        }}
      />
    </div>
  )
}

// ─── Create dialog ────────────────────────────────────────────────────────

function CreateQrDialog({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  workspaceId: string
  onCreated: () => void
}) {
  const [targetId, setTargetId] = useState('')
  const [label, setLabel] = useState('')

  const surveysQuery = trpc.survey.list.useQuery(
    { workspaceId, includeArchived: false },
    { enabled: !!workspaceId && open },
  )

  const createMutation = trpc.qr.create.useMutation({
    onSuccess: () => {
      toast.success('QR created')
      setTargetId('')
      setLabel('')
      onCreated()
    },
    onError: (e) => toast.error(e.message),
  })

  const surveys = surveysQuery.data ?? []
  const chosen = surveys.find((s) => s.id === targetId)

  async function handleCreate() {
    if (!chosen) {
      toast.error('Pick a journey or truform first')
      return
    }
    const targetType: 'journey' | 'form' =
      chosen.template === 'deep' ? 'form' : 'journey'
    await createMutation.mutateAsync({
      workspaceId,
      targetType,
      targetId: chosen.id,
      label: label.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create QR code</DialogTitle>
          <DialogDescription>
            Pick the journey or truform this QR should land on. The
            tracking link is generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Target</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a journey or truform…" />
              </SelectTrigger>
              <SelectContent>
                {surveysQuery.isLoading && (
                  <div className="p-2 text-sm text-muted-foreground">
                    Loading…
                  </div>
                )}
                {!surveysQuery.isLoading && surveys.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    No surveys yet. Create one first from Customer Journeys.
                  </div>
                )}
                {surveys.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span>{s.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {s.template === 'deep' ? 'TruForm' : 'Journey'}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Label / purpose</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Counter sticker, Receipt footer, Diwali campaign…"
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">
              Optional but recommended — helps you tell apart QRs that
              point at the same survey.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!targetId || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Create QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
