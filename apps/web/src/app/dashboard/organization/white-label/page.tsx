'use client'

import { useEffect, useState } from 'react'
import { Loader2, Palette, Save, Eye } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

type WhiteLabel = {
  enabled?: boolean
  logoUrl?: string
  faviconUrl?: string
  primaryColor?: string
  secondaryColor?: string
  footerText?: string
  supportEmail?: string
  supportPhone?: string
  customDomain?: string
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export default function WhiteLabelPage() {
  const { currentOrganizationId } = useAuthStore()
  const utils = trpc.useUtils()

  const orgQuery = trpc.organization.getById.useQuery(
    { organizationId: currentOrganizationId! },
    { enabled: !!currentOrganizationId },
  )

  const [draft, setDraft] = useState<WhiteLabel>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (orgQuery.data?.whiteLabel) {
      setDraft(orgQuery.data.whiteLabel as WhiteLabel)
      setDirty(false)
    }
  }, [orgQuery.data?.whiteLabel])

  const updateMutation = trpc.organization.update.useMutation({
    onSuccess: () => {
      toast.success('White-label settings saved')
      setDirty(false)
      utils.organization.getById.invalidate({ organizationId: currentOrganizationId! })
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  })

  function patch(p: Partial<WhiteLabel>) {
    setDraft((d) => ({ ...d, ...p }))
    setDirty(true)
  }

  function handleSave() {
    if (!currentOrganizationId) return
    // Validate hex colours before submitting (server validator will too).
    if (draft.primaryColor && !HEX_RE.test(draft.primaryColor)) {
      toast.error('Primary color must be a 6-digit hex like #2D5BFF')
      return
    }
    if (draft.secondaryColor && !HEX_RE.test(draft.secondaryColor)) {
      toast.error('Secondary color must be a 6-digit hex')
      return
    }

    // Strip empty strings so we don't store noise.
    const cleaned: WhiteLabel = {}
    for (const [k, v] of Object.entries(draft)) {
      if (v === '' || v === undefined || v === null) continue
      ;(cleaned as any)[k] = v
    }

    updateMutation.mutate({
      organizationId: currentOrganizationId,
      whiteLabel: cleaned,
    })
  }

  if (!currentOrganizationId) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>
  }

  if (orgQuery.isLoading || !orgQuery.data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const org = orgQuery.data
  const isAgency = org.type === 'agency'
  const isOwner = org.myRole === 'org_owner' || org.myRole === 'org_admin'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="size-6 text-primary" />
            White-label
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Customize the look and feel of the dashboard, public journey/form pages, and PDF
            reports. Most useful in agency mode where each client sees your branding.
          </p>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Save className="size-4" />
                Save changes
              </>
            )}
          </Button>
        )}
      </div>

      {!isAgency && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Your org is in <strong>{org.type}</strong> mode. White-label is most useful for{' '}
            <strong>agency</strong> mode (your branding wraps every client&apos;s dashboard). You
            can still configure these settings — they&apos;ll apply when you switch types.
          </CardContent>
        </Card>
      )}

      {!isOwner && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Only org owners and admins can change white-label settings. Read-only view below.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Master switch</CardTitle>
          <CardDescription>
            When off, the platform&apos;s default branding applies everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            checked={!!draft.enabled}
            disabled={!isOwner}
            onCheckedChange={(v) => patch({ enabled: v })}
          />
          <span className="text-sm">
            {draft.enabled ? 'White-label enabled' : 'White-label disabled (default branding)'}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo & favicon</CardTitle>
          <CardDescription>
            URLs to host your logo and favicon. We don&apos;t host these for you (yet) — paste a
            CDN or S3-style URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              value={draft.logoUrl ?? ''}
              disabled={!isOwner}
              placeholder="https://cdn.example.com/agency-logo.png"
              onChange={(e) => patch({ logoUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Favicon URL</Label>
            <Input
              value={draft.faviconUrl ?? ''}
              disabled={!isOwner}
              placeholder="https://cdn.example.com/favicon.ico"
              onChange={(e) => patch({ faviconUrl: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand colors</CardTitle>
          <CardDescription>
            6-digit hex like <code>#2D5BFF</code>. Applied as CSS variables to dashboard chrome
            (header, sidebar, primary buttons).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.primaryColor ?? '#000000'}
                disabled={!isOwner}
                onChange={(e) => patch({ primaryColor: e.target.value.toUpperCase() })}
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                className="font-mono"
                value={draft.primaryColor ?? ''}
                disabled={!isOwner}
                placeholder="#2D5BFF"
                onChange={(e) => patch({ primaryColor: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Secondary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.secondaryColor ?? '#FFFFFF'}
                disabled={!isOwner}
                onChange={(e) => patch({ secondaryColor: e.target.value.toUpperCase() })}
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                className="font-mono"
                value={draft.secondaryColor ?? ''}
                disabled={!isOwner}
                placeholder="#FFFFFF"
                onChange={(e) => patch({ secondaryColor: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support contacts</CardTitle>
          <CardDescription>
            Shown on public pages and in transactional emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Support email</Label>
            <Input
              type="email"
              value={draft.supportEmail ?? ''}
              disabled={!isOwner}
              placeholder="support@your-agency.com"
              onChange={(e) => patch({ supportEmail: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Support phone</Label>
            <Input
              value={draft.supportPhone ?? ''}
              disabled={!isOwner}
              placeholder="+91 99999 99999"
              onChange={(e) => patch({ supportPhone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Footer text</Label>
            <textarea
              value={draft.footerText ?? ''}
              disabled={!isOwner}
              placeholder="Powered by Mumbai Reputation Agency"
              maxLength={500}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                patch({ footerText: e.target.value })
              }
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            Preview
          </CardTitle>
          <CardDescription>
            How your branding looks at a glance. Save to apply across the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border p-6 space-y-2"
            style={{
              backgroundColor: draft.secondaryColor ?? '#ffffff',
            }}
          >
            <div
              className="inline-block px-3 py-1 rounded text-sm font-medium"
              style={{
                backgroundColor: draft.primaryColor ?? '#0f172a',
                color: draft.secondaryColor ?? '#ffffff',
              }}
            >
              Primary button
            </div>
            <p className="text-xs" style={{ color: draft.primaryColor ?? '#0f172a' }}>
              Sample text using your primary color.
            </p>
            {draft.footerText && (
              <p className="text-[11px] text-muted-foreground pt-2 border-t mt-3">
                {draft.footerText}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
