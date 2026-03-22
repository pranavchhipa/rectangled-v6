'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Route,
  Plus,
  Archive,
  ExternalLink,
  Calendar,
  Layers,
  QrCode,
  Copy,
  Download,
  Pencil,
  MessageSquare,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function JourneySkeletons() {
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
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}

function QrCodeDialog({
  open,
  onOpenChange,
  journeySlug,
  journeyId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  journeySlug: string
  journeyId: string
}) {
  const [qrSize, setQrSize] = useState('256')
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/j/${journeySlug}`
    : `/j/${journeySlug}`

  const qrQuery = trpc.qr.generateJourneyQr.useQuery(
    { journeyId, size: parseInt(qrSize) },
    { enabled: open && !!journeyId }
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Share this QR code so customers can start their feedback journey.
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
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
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
              link.download = `journey-${journeySlug}-qr.png`
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

export default function JourneysPage() {
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [qrJourney, setQrJourney] = useState<{ id: string; slug: string } | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const journeysQuery = trpc.journey.list.useQuery(
    { workspaceId: currentWorkspaceId!, includeArchived: showArchived },
    { enabled: !!currentWorkspaceId }
  )

  const createMutation = trpc.journey.create.useMutation({
    onSuccess: (data) => {
      toast.success('Journey created')
      setCreateOpen(false)
      setNewName('')
      utils.journey.list.invalidate()
      router.push(`/dashboard/journeys/${data.id}`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create journey')
    },
  })

  const updateMutation = trpc.journey.update.useMutation({
    onSuccess: () => {
      utils.journey.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update journey')
    },
  })

  const archiveMutation = trpc.journey.archive.useMutation({
    onSuccess: () => {
      toast.success('Journey archived')
      setArchiveId(null)
      utils.journey.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive journey')
    },
  })

  const journeys = journeysQuery.data ?? []

  function handleCreate() {
    if (!newName.trim() || !currentWorkspaceId) return
    createMutation.mutate({ workspaceId: currentWorkspaceId, name: newName.trim() })
  }

  function handleToggleActive(id: string, isActive: boolean) {
    updateMutation.mutate({ id, isActive })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journeys</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage customer feedback journeys.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Create Journey
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Journey</DialogTitle>
              <DialogDescription>
                Give your journey a name. You can configure screens after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="journey-name">Journey Name</Label>
              <Input
                id="journey-name"
                placeholder="e.g. Post-visit feedback"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Archived filter */}
      <div className="flex items-center gap-2">
        <Switch
          checked={showArchived}
          onCheckedChange={setShowArchived}
          id="show-archived"
        />
        <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
          Show archived journeys
        </Label>
      </div>

      {/* Content */}
      {journeysQuery.isLoading ? (
        <JourneySkeletons />
      ) : journeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Route className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No journeys yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Create your first customer feedback journey to start collecting reviews.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create Journey
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {journeys.map((journey: any) => (
            <Card
              key={journey.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/dashboard/journeys/${journey.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate pr-2">
                    {journey.name}
                  </CardTitle>
                  <Badge variant={journey.archivedAt ? 'outline' : journey.isActive ? 'default' : 'secondary'}>
                    {journey.archivedAt ? 'Archived' : journey.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs">
                  /j/{journey.slug}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Layers className="size-3" />
                      Screens
                    </div>
                    <p className="text-sm font-semibold mt-0.5">
                      {journey.screens?.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="size-3" />
                      Responses
                    </div>
                    <p className="text-sm font-semibold mt-0.5">
                      {journey.responseCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      Created
                    </div>
                    <p className="text-xs font-medium mt-0.5">
                      {new Date(journey.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Last response */}
                {journey.lastResponseAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last response: {new Date(journey.lastResponseAt).toLocaleDateString()}
                  </p>
                )}

                {/* Actions row */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={journey.isActive}
                      onCheckedChange={(checked) =>
                        handleToggleActive(journey.id, checked)
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {journey.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Edit"
                      onClick={() => router.push(`/dashboard/journeys/${journey.id}`)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Preview"
                      onClick={() => window.open(`/j/${journey.slug}`, '_blank')}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="QR Code"
                      onClick={() => setQrJourney({ id: journey.id, slug: journey.slug })}
                    >
                      <QrCode className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      title="Archive"
                      onClick={() => setArchiveId(journey.id)}
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archive confirmation dialog */}
      <Dialog
        open={!!archiveId}
        onOpenChange={(open) => {
          if (!open) setArchiveId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Journey</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this journey? It will be deactivated
              and hidden from the list. You can view archived journeys later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (archiveId) archiveMutation.mutate({ id: archiveId })
              }}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      {qrJourney && (
        <QrCodeDialog
          open={!!qrJourney}
          onOpenChange={(open) => {
            if (!open) setQrJourney(null)
          }}
          journeySlug={qrJourney.slug}
          journeyId={qrJourney.id}
        />
      )}
    </div>
  )
}
