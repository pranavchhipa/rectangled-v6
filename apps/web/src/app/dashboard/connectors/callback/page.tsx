'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'

export default function GbpCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const processed = useRef(false)

  const callbackMutation = trpc.connector.handleGbpCallback.useMutation({
    onSuccess: () => {
      toast.success('Google Business Profile connected successfully!')
      router.replace('/dashboard/connectors')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to connect Google Business Profile')
      router.replace('/dashboard/connectors')
    },
  })

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const code = searchParams.get('code')
    const stateRaw = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      toast.error(`Google authorization failed: ${error}`)
      router.replace('/dashboard/connectors')
      return
    }

    if (!code || !stateRaw) {
      toast.error('Missing authorization code from Google')
      router.replace('/dashboard/connectors')
      return
    }

    let state: { workspaceId?: string; locationId?: string }
    try {
      state = JSON.parse(stateRaw)
    } catch {
      toast.error('Invalid callback state')
      router.replace('/dashboard/connectors')
      return
    }

    if (!state.workspaceId) {
      toast.error('Missing workspace information')
      router.replace('/dashboard/connectors')
      return
    }

    callbackMutation.mutate({
      code,
      workspaceId: state.workspaceId,
      locationId: state.locationId,
      redirectUrl: `${window.location.origin}/dashboard/connectors/callback`,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">
        Connecting your Google Business Profile...
      </p>
    </div>
  )
}
