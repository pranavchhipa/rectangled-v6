'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const INDUSTRIES = [
  'restaurant',
  'retail',
  'healthcare',
  'hospitality',
  'education',
  'automotive',
  'real_estate',
  'other',
] as const

const TONE_PRESETS = [
  'professional',
  'friendly',
  'empathetic',
  'witty',
] as const

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function WorkspaceSettingsForm() {
  const queryClient = useQueryClient()
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  const memberships = useAuthStore((s) => s.memberships)
  const setMemberships = useAuthStore((s) => s.setMemberships)

  const { data: workspaces, isLoading } = trpc.workspace.list.useQuery()

  const workspace = workspaces?.find((w) => w?.id === currentWorkspaceId)

  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [tonePreset, setTonePreset] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setIndustry(workspace.industry ?? '')
      setTonePreset(workspace.tonePreset ?? '')
      setLogoUrl((workspace as any).logoUrl ?? '')
    }
  }, [workspace])

  const updateMutation = trpc.workspace.update.useMutation({
    onSuccess: (updated) => {
      toast.success('Workspace settings saved.')
      queryClient.invalidateQueries({ queryKey: [['workspace']] })
      // Patch the in-memory auth store so the sidebar logo updates
      // immediately without needing a hard refresh.
      if (updated && currentWorkspaceId) {
        setMemberships(
          memberships.map((m) =>
            m.workspaceId === currentWorkspaceId
              ? { ...m, workspaceLogoUrl: (updated as any).logoUrl ?? null }
              : m,
          ),
        )
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save workspace settings.')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!currentWorkspaceId) {
      toast.error('No workspace selected.')
      return
    }

    if (!name.trim()) {
      toast.error('Workspace name is required.')
      return
    }

    const trimmedLogo = logoUrl.trim()
    updateMutation.mutate({
      id: currentWorkspaceId,
      name: name.trim(),
      industry: industry || undefined,
      tonePreset: (tonePreset || undefined) as 'professional' | 'friendly' | 'empathetic' | 'witty' | undefined,
      logoUrl: trimmedLogo === '' ? null : trimmedLogo,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!workspace) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No workspace selected. Please select a workspace first.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Settings</CardTitle>
        <CardDescription>
          Update your workspace name, industry, and response tone.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-slug">Slug</Label>
            <Input
              id="workspace-slug"
              value={workspace.slug}
              disabled
              className="bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              The slug is auto-generated and cannot be changed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-industry">Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id="workspace-industry" className="w-full">
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {formatLabel(ind)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-tone">Tone Preset</Label>
            <Select value={tonePreset} onValueChange={setTonePreset}>
              <SelectTrigger id="workspace-tone" className="w-full">
                <SelectValue placeholder="Select a tone" />
              </SelectTrigger>
              <SelectContent>
                {TONE_PRESETS.map((tone) => (
                  <SelectItem key={tone} value={tone}>
                    {formatLabel(tone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-logo">Business Logo URL</Label>
            <div className="flex items-start gap-3">
              {logoUrl.trim() && (
                <img
                  src={logoUrl.trim()}
                  alt="Logo preview"
                  className="h-12 w-12 rounded-md border object-cover bg-muted shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3'
                  }}
                />
              )}
              <div className="flex-1 space-y-1">
                <Input
                  id="workspace-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://… (paste your business logo URL)"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the sidebar and on customer-facing review pages.
                  You can grab the URL from your Google Business Profile (right-click logo → Copy image address) or any image host.
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
