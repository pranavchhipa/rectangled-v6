'use client'

import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  Users,
  Building2,
  ArrowRight,
  Activity,
  BarChart3,
  MessageSquare,
} from 'lucide-react'

export function AdminTab() {
  const { currentWorkspaceId, memberships } = useAuthStore()

  const currentWorkspace = memberships.find(
    (m) => m.workspaceId === currentWorkspaceId
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Centre</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Workspace management and administration
        </p>
      </div>

      {/* Workspace info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {currentWorkspace?.workspaceName ?? 'No workspace'}
              </p>
              <p className="text-sm text-muted-foreground">
                Role: {currentWorkspace?.role ?? 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Billing</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your subscription, view invoices, and update payment methods.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/settings?tab=billing">
                Go to Billing
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Team Management</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Invite team members, manage roles, and control access permissions.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/members">
                Manage Team
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Usage overview (placeholder metrics) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AI Responses</p>
                <p className="text-xl font-bold">--</p>
                <p className="text-xs text-muted-foreground">this month</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reviews Processed</p>
                <p className="text-xl font-bold">--</p>
                <p className="text-xs text-muted-foreground">this month</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">API Calls</p>
                <p className="text-xl font-bold">--</p>
                <p className="text-xs text-muted-foreground">this month</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
