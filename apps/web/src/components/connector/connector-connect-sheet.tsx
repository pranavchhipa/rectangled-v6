'use client'

import { useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

interface ConnectorType {
  id: string
  name: string
  description: string | null
  authType: string
  bindingLevel: string
}

interface ConnectorConnectSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorType: ConnectorType | null
}

export function ConnectorConnectSheet({
  open,
  onOpenChange,
  connectorType,
}: ConnectorConnectSheetProps) {
  const { currentWorkspaceId } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')

  // Email connector state
  const [emailProvider, setEmailProvider] = useState<string>('')
  const [emailApiKey, setEmailApiKey] = useState<string>('')
  const [fromEmail, setFromEmail] = useState<string>('')

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId && open }
  )

  const locations = locationsQuery.data ?? []

  const gbpAuthQuery = trpc.connector.getGbpAuthUrl.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      locationId: selectedLocationId || undefined,
      redirectUrl: typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/connectors/callback`
        : '',
    },
    { enabled: false } // manual trigger
  )

  const connectMutation = trpc.connector.connect.useMutation({
    onSuccess: () => {
      toast.success('Connector connected successfully')
      queryClient.invalidateQueries({ queryKey: [['connector', 'listInstances']] })
      onOpenChange(false)
      resetEmailForm()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to connect')
    },
  })

  const isGbp = connectorType?.id === 'gbp'
  const isEmail = connectorType?.id === 'email'
  const isLocationBound = connectorType?.bindingLevel === 'location'

  function resetEmailForm() {
    setEmailProvider('')
    setEmailApiKey('')
    setFromEmail('')
  }

  async function handleAuthorize() {
    if (isGbp) {
      const result = await gbpAuthQuery.refetch()
      const url = result.data?.url
      if (url) {
        window.location.href = url
      }
    }
  }

  function handleEmailConnect() {
    if (!currentWorkspaceId || !emailProvider || !emailApiKey || !fromEmail) return

    connectMutation.mutate({
      connectorTypeId: 'email',
      workspaceId: currentWorkspaceId,
      credentials: { apiKey: emailApiKey },
      config: { provider: emailProvider, fromEmail },
    })
  }

  const canProceed = !isLocationBound || !!selectedLocationId
  const canSubmitEmail = !!emailProvider && !!emailApiKey && !!fromEmail

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Connect {connectorType?.name}</SheetTitle>
          <SheetDescription>
            {connectorType?.description}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1: Select location (for location-bound connectors) */}
          {isLocationBound && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select a location to connect
              </label>
              {locationsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading locations...
                </div>
              ) : locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No locations found. Add a location first before connecting a
                  platform.
                </p>
              ) : (
                <Select
                  value={selectedLocationId}
                  onValueChange={setSelectedLocationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.city ? ` — ${loc.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* GBP OAuth flow */}
          {isGbp && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p>
                  You'll be redirected to Google to authorize access to your
                  Business Profile. We'll use this to fetch and respond to your
                  reviews.
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleAuthorize}
                disabled={!canProceed || gbpAuthQuery.isFetching}
              >
                {gbpAuthQuery.isFetching ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="size-4 mr-2" />
                    Authorize with Google
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Email Provider Form */}
          {isEmail && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p>
                  Connect your own email provider to send review requests,
                  coupons, and notifications from your domain.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Provider</label>
                <Select value={emailProvider} onValueChange={setEmailProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  placeholder={
                    emailProvider === 'sendgrid'
                      ? 'SG.xxxxxxxxxxxxxxxx'
                      : emailProvider === 'resend'
                        ? 're_xxxxxxxxxxxxxxxx'
                        : 'Select a provider first'
                  }
                  value={emailApiKey}
                  onChange={(e) => setEmailApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">From Email</label>
                <Input
                  type="email"
                  placeholder="reviews@yourbusiness.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be a verified sender in your {emailProvider || 'email'} account.
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleEmailConnect}
                disabled={!canSubmitEmail || connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  'Connect Email Provider'
                )}
              </Button>

              {connectMutation.isError && (
                <p className="text-sm text-destructive">
                  Failed to connect: {connectMutation.error.message}
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
