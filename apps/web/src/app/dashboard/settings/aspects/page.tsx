'use client'

import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Loader2,
  X,
  Check,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function AspectsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Query
  const aspectsQuery = trpc.businessAspect.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Mutations
  const createAspect = trpc.businessAspect.create.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
      setNewName('')
      setNewCategory('')
      setShowAddForm(false)
      toast.success('Aspect created')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create aspect')
    },
  })

  const updateAspect = trpc.businessAspect.update.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
      setEditingId(null)
      toast.success('Aspect updated')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update aspect')
    },
  })

  const deleteAspect = trpc.businessAspect.delete.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
      setDeleteId(null)
      toast.success('Aspect deleted')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete aspect')
    },
  })

  const reorderAspects = trpc.businessAspect.reorder.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder aspects')
    },
  })

  const aspects = aspectsQuery.data ?? []

  function handleCreate() {
    if (!newName.trim() || !currentWorkspaceId) return
    createAspect.mutate({
      workspaceId: currentWorkspaceId,
      name: newName.trim(),
      category: newCategory.trim() || undefined,
    })
  }

  function handleStartEdit(aspect: { id: string; name: string; category: string | null }) {
    setEditingId(aspect.id)
    setEditName(aspect.name)
    setEditCategory(aspect.category ?? '')
  }

  function handleSaveEdit() {
    if (!editingId || !editName.trim()) return
    updateAspect.mutate({
      id: editingId,
      name: editName.trim(),
      category: editCategory.trim() || undefined,
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditCategory('')
  }

  function handleToggleActive(id: string, isActive: boolean) {
    updateAspect.mutate({ id, isActive: !isActive })
  }

  function handleConfirmDelete() {
    if (!deleteId) return
    deleteAspect.mutate({ id: deleteId })
  }

  function handleMoveUp(index: number) {
    if (index === 0 || !currentWorkspaceId) return
    const ids = aspects.map((a) => a.id)
    const temp = ids[index]
    ids[index] = ids[index - 1]
    ids[index - 1] = temp
    reorderAspects.mutate({ workspaceId: currentWorkspaceId, orderedIds: ids })
  }

  function handleMoveDown(index: number) {
    if (index === aspects.length - 1 || !currentWorkspaceId) return
    const ids = aspects.map((a) => a.id)
    const temp = ids[index]
    ids[index] = ids[index + 1]
    ids[index + 1] = temp
    reorderAspects.mutate({ workspaceId: currentWorkspaceId, orderedIds: ids })
  }

  const deletingAspect = aspects.find((a) => a.id === deleteId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Aspects</h1>
          <p className="text-sm text-muted-foreground">
            Manage the aspects of your business used for review analysis.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Aspect
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  placeholder="e.g. Food Quality"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-category">Category (optional)</Label>
                <Input
                  id="new-category"
                  placeholder="e.g. Service"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setNewName('')
                  setNewCategory('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createAspect.isPending}
              >
                {createAspect.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {aspectsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : aspects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <LayoutGrid className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No business aspects</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Add aspects to start analyzing reviews against specific areas of your business.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {aspects.map((aspect, index) => (
            <div
              key={aspect.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === 0 || reorderAspects.isPending}
                  onClick={() => handleMoveUp(index)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === aspects.length - 1 || reorderAspects.isPending}
                  onClick={() => handleMoveDown(index)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>

              {/* Toggle */}
              <Switch
                checked={aspect.isActive}
                onCheckedChange={() => handleToggleActive(aspect.id, aspect.isActive)}
              />

              {/* Name / Edit */}
              {editingId === aspect.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                  />
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Category"
                    className="h-8 w-32"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSaveEdit}
                    disabled={updateAspect.isPending}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span
                    className={`text-sm font-medium truncate ${
                      !aspect.isActive ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {aspect.name}
                  </span>
                  {aspect.category && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {aspect.category}
                    </Badge>
                  )}
                  {aspect.isDefault && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      Default
                    </Badge>
                  )}
                </div>
              )}

              {/* Actions */}
              {editingId !== aspect.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStartEdit(aspect)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(aspect.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Separator className="my-2" />
          <p className="text-xs text-muted-foreground text-center">
            {aspects.filter((a) => a.isActive).length} of {aspects.length} aspects active
          </p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Aspect</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingAspect?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteAspect.isPending}
            >
              {deleteAspect.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
