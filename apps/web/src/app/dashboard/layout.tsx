'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { AiChatWidget } from '@/components/dashboard/ai-chat-widget'
import { OrgHydrator } from '@/components/dashboard/org-hydrator'
import { WhiteLabelTheme } from '@/components/dashboard/white-label-theme'
import { useAuthStore } from '@/stores/auth-store'
import { trpc } from '@/lib/trpc'
import { Skeleton } from '@/components/ui/skeleton'

function DashboardSkeleton() {
  return (
    <div className="flex h-screen bg-muted">
      <div className="w-64 bg-background border-r p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b bg-background px-4 flex items-center">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { currentWorkspaceId } = useAuthStore()

  const onboardingQuery = trpc.onboarding.getState.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const isOnboardingRoute = pathname.startsWith('/dashboard/onboarding')

  useEffect(() => {
    if (!onboardingQuery.data) return
    const { isComplete } = onboardingQuery.data

    if (!isComplete && !isOnboardingRoute) {
      router.replace('/dashboard/onboarding')
    }
  }, [onboardingQuery.data, isOnboardingRoute, router])

  // While loading onboarding state, show children (avoids flash)
  // The onboarding page itself handles its own redirect if already complete
  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isReady, isLoading } = useAuthGuard()

  if (isLoading || !isReady) {
    return <DashboardSkeleton />
  }

  return (
    <SidebarProvider>
      <OrgHydrator />
      <WhiteLabelTheme>
        <DashboardSidebar />
        <SidebarInset>
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto p-6">
            <OnboardingGuard>{children}</OnboardingGuard>
          </main>
        </SidebarInset>
      </WhiteLabelTheme>
      <AiChatWidget />
    </SidebarProvider>
  )
}
