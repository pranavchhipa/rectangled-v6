'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'

export function useAuthGuard() {
  const router = useRouter()
  const { accessToken, setUser, setMemberships, logout } = useAuthStore()
  const [isReady, setIsReady] = useState(false)

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  })

  useEffect(() => {
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
  }, [accessToken, meQuery.data, meQuery.error, router, setUser, setMemberships, logout])

  return { isReady, isLoading: meQuery.isLoading }
}
