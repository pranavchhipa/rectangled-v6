'use client'

import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../trpc-types'

export const trpc = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/trpc`,
        headers() {
          const stored =
            typeof window !== 'undefined'
              ? localStorage.getItem('rectangled-auth')
              : null
          if (stored) {
            try {
              const { state } = JSON.parse(stored)
              if (state?.accessToken) {
                return { Authorization: `Bearer ${state.accessToken}` }
              }
            } catch {
              // ignore parse errors
            }
          }
          return {}
        },
      }),
    ],
  })
}
