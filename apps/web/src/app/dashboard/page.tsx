'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  Users,
  Plug,
  MessageSquare,
  CheckCircle2,
  Circle,
  ArrowRight,
  Building2,
  Star,
  Bot,
  Route,
  TrendingUp,
} from 'lucide-react'

export default function DashboardPage() {
  const { user, currentWorkspaceId, memberships } = useAuthStore()

  const currentWorkspace = memberships.find(
    (m) => m.workspaceId === currentWorkspaceId
  )

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const membersQuery = trpc.member.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const connectorsQuery = trpc.connector.listInstances.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const reviewStatsQuery = trpc.review.stats.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const journeysQuery = trpc.journey.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const locationCount = locationsQuery.data?.length ?? 0
  const memberCount = membersQuery.data?.length ?? 0
  const connectorCount = connectorsQuery.data?.length ?? 0
  const reviewCount = reviewStatsQuery.data?.totalReviews ?? 0
  const avgRating = reviewStatsQuery.data?.averageRating ?? 0
  const responseRate = reviewStatsQuery.data?.responseRate ?? 0
  const activeJourneys = (journeysQuery.data ?? []).filter((j: any) => j.isActive).length
  const isLoading =
    locationsQuery.isLoading ||
    membersQuery.isLoading ||
    connectorsQuery.isLoading ||
    reviewStatsQuery.isLoading

  const checklist = [
    {
      label: 'Add your first location',
      done: locationCount > 0,
      href: '/dashboard/locations',
    },
    {
      label: 'Invite a team member',
      done: memberCount > 1,
      href: '/dashboard/members',
    },
    {
      label: 'Connect a review platform',
      done: connectorCount > 0,
      href: '/dashboard/connectors',
    },
    {
      label: 'Sync your first reviews',
      done: reviewCount > 0,
      href: '/dashboard/reviews',
    },
  ]

  const completedCount = checklist.filter((c) => c.done).length

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-primary/10">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Welcome back, {user?.name?.split(' ')[0]}
              </h1>
              <p className="text-muted-foreground mt-1">
                {currentWorkspace?.workspaceName
                  ? `Managing ${currentWorkspace.workspaceName}`
                  : 'Your ORM command center'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <TrendingUp className="w-3 h-3" />
                +12%
              </div>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{reviewCount}</p>
              )}
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Reviews</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              {avgRating > 0 && (
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <TrendingUp className="w-3 h-3" />
                  Stable
                </div>
              )}
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                  {avgRating > 0 ? avgRating.toFixed(1) : '--'}
                </p>
              )}
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Average Rating</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              {responseRate > 50 && (
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <TrendingUp className="w-3 h-3" />
                  Good
                </div>
              )}
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{responseRate}%</p>
              )}
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Response Rate</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Route className="w-5 h-5 text-emerald-600" />
              </div>
              {activeJourneys > 0 && (
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <TrendingUp className="w-3 h-3" />
                  {activeJourneys} active
                </div>
              )}
            </div>
            <div>
              {isLoading || journeysQuery.isLoading ? (
                <Skeleton className="h-9 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{activeJourneys}</p>
              )}
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Active Journeys</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Locations</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-10 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold">{locationCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reviews</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-10 mt-0.5" />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">{reviewCount}</p>
                    {avgRating > 0 && (
                      <div className="flex items-center gap-0.5 text-xs text-amber-600">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {avgRating.toFixed(1)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Plug className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Connectors</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-10 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold">{connectorCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-10 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold">{memberCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding checklist */}
      {completedCount < checklist.length && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Getting Started</CardTitle>
              <span className="text-xs text-muted-foreground">
                {completedCount}/{checklist.length} completed
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{
                  width: `${(completedCount / checklist.length) * 100}%`,
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {checklist.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  item.done ? 'opacity-60' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span
                    className={`text-sm ${item.done ? 'line-through text-muted-foreground' : 'font-medium'}`}
                  >
                    {item.label}
                  </span>
                </div>
                {!item.done && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Add a Location</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add your business locations to start managing reviews and
              collecting feedback.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/locations">
                Go to Locations
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Plug className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Connect a Platform</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect Google Business Profile or other review platforms to start
              syncing reviews.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/connectors">
                Go to Connectors
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
