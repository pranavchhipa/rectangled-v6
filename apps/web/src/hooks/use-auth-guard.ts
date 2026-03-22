'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'

export function useAuthGuard() {
  const router = useRouter()
  const { accessToken, setUser, setMemberships, logout } = useAuthStore()
  const [isReady, setIsReady] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Wait for zustand to hydrate from localStorage before checking auth
  useEffect(() => {
    // Zustand persist hydrates synchronously after first render
    // Small timeout ensures localStorage values are loaded
    const timer = setTimeout(() => setHydrated(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hydrated && !!accessToken,
    retry: false,
  })

  useEffect(() => {
    if (!hydrated) return // Don't redirect before hydration

    if (!accessToken) {
      router.replace('/login')
      return
    }

    if (meQuery.data) {
      setUser(meQuery.data.user)
      setMemberships(meQuery.data.memberships)
      setIsReady(true)
    }

    if (meQuery.error) {
      logout()
      router.replace('/login')
    }
  }, [hydrated, accessToken, meQuery.data, meQuery.error, router, setUser, setMemberships, logout])

  return { isReady, isLoading: !hydrated || meQuery.isLoading }
}
