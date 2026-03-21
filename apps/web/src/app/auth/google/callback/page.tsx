'use client'

import { useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'

function GoogleCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTokens, setUser, setMemberships } = useAuthStore()
  const processedRef = useRef(false)

  const googleCallback = trpc.auth.googleCallback.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken)
      setUser(data.user)
      router.replace('/dashboard')
    },
    onError: () => {
      router.replace('/login?error=google_failed')
    },
  })

  useEffect(() => {
    if (processedRef.current) return
    const code = searchParams.get('code')
    if (code) {
      processedRef.current = true
      googleCallback.mutate({ code })
    } else {
      router.replace('/login?error=no_code')
    }
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  )
}
