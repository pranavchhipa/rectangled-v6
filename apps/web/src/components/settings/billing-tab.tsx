'use client'

import { useState } from 'react'
import {
  CreditCard,
  Check,
  Download,
  AlertTriangle,
  MapPin,
  Users,
  Star,
  Plug,
  Bot,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// --- Plan definitions ---

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    description: 'Get started with basic review management',
    features: [
      '1 Location',
      '1 Team Member',
      '50 Reviews/month',
      '1 Connector',
      '5 AI Responses/day',
    ],
    limits: {
      locations: 1,
      teamMembers: 1,
      reviewsPerMonth: 50,
      connectors: 1,
      aiResponsesPerDay: 5,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 2999,
    priceLabel: '\u20B92,999/month',
    description: 'For growing businesses that need more power',
    popular: true,
    features: [
      '10 Locations',
      '10 Team Members',
      'Unlimited Reviews',
      '5 Connectors',
      '100 AI Responses/day',
      'Advanced Analytics',
      'Coupon Engine',
      'Automation Rules',
    ],
    limits: {
      locations: 10,
      teamMembers: 10,
      reviewsPerMonth: -1,
      connectors: 5,
      aiResponsesPerDay: 100,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    priceLabel: '\u20B99,999/month',
    description: 'For large organizations with custom needs',
    features: [
      'Unlimited Locations',
      'Unlimited Team Members',
      'Unlimited Reviews',
      'Unlimited Connectors',
      'Unlimited AI Responses',
      'White-label Option',
      'Dedicated Support',
      'Custom Integrations',
      'SLA Guarantees',
    ],
    limits: {
      locations: -1,
      teamMembers: -1,
      reviewsPerMonth: -1,
      connectors: -1,
      aiResponsesPerDay: -1,
    },
  },
]

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

const invoiceStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
}

const usageIcons = {
  locations: MapPin,
  teamMembers: Users,
  reviewsPerMonth: Star,
  connectors: Plug,
  aiResponsesPerDay: Bot,
}

const usageLabels: Record<string, string> = {
  locations: 'Locations',
  teamMembers: 'Team Members',
  reviewsPerMonth: 'Reviews / month',
  connectors: 'Connectors',
  aiResponsesPerDay: 'AI Responses / day',
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export function BillingTab() {
  const { currentWorkspaceId } = useAuthStore()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [invoicePage, setInvoicePage] = useState(1)

  const planQuery = trpc.billing.getCurrentPlan.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const invoicesQuery = trpc.billing.listInvoices.useQuery(
    { workspaceId: currentWorkspaceId!, page: invoicePage, limit: 10 },
    { enabled: !!currentWorkspaceId }
  )

  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data: any) => {
      if (data?.url) {
        window.open(data.url, '_blank')
      } else {
        toast.success('Checkout session created. Redirecting...')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create checkout session')
    },
  })

  const cancelMutation = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success('Subscription cancelled')
      setCancelOpen(false)
      planQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to cancel subscription')
    },
  })

  if (planQuery.isLoading) return <BillingSkeleton />

  const currentPlan = (planQuery.data as any) ?? null
  const currentPlanId: string = currentPlan?.plan ?? 'free'
  const planStatus: string = currentPlan?.status ?? 'active'
  const usage: Record<string, number> = currentPlan?.usage ?? {}
  const limits: Record<string, number> = currentPlan?.limits ?? {}
  const invoices = (invoicesQuery.data as any)?.items ?? (invoicesQuery.data as any) ?? []
  const invoiceTotal = (invoicesQuery.data as any)?.total ?? 0

  function handleUpgrade(planId: string) {
    if (!currentWorkspaceId) return
    checkoutMutation.mutate({
      workspaceId: currentWorkspaceId,
      plan: planId as 'pro' | 'enterprise',
    })
  }

  function handleCancel() {
    if (!currentWorkspaceId) return
    cancelMutation.mutate({ workspaceId: currentWorkspaceId })
  }

  function getUsagePercent(key: string): number {
    const used = usage[key] ?? 0
    const limit = limits[key] ?? 0
    if (limit <= 0) return 0
    return Math.min(100, Math.round((used / limit) * 100))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Manage your plan, usage, and invoices.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Current Plan</CardTitle>
              <Badge
                className={
                  currentPlanId === 'pro'
                    ? 'bg-primary text-primary-foreground'
                    : currentPlanId === 'enterprise'
                      ? 'bg-violet-600 text-white'
                      : ''
                }
              >
                {currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1)}
              </Badge>
              <Badge
                variant="outline"
                className={statusColors[planStatus] ?? ''}
              >
                {planStatus.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <CardDescription>
            Your usage and limits for the current billing period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Object.entries(usageLabels).map(([key, label]) => {
              const Icon = usageIcons[key as keyof typeof usageIcons]
              const used = usage[key] ?? 0
              const limit = limits[key] ?? 0
              const pct = getUsagePercent(key)
              const isUnlimited = limit < 0
              const isMaxed = !isUnlimited && pct >= 100
              return (
                <div
                  key={key}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {used}
                    <span className="text-sm font-normal text-muted-foreground">
                      {isUnlimited ? ' / \u221E' : ` / ${limit}`}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <Progress
                      value={pct}
                      className={isMaxed ? '[&>[data-slot=progress-indicator]]:bg-destructive' : ''}
                    />
                  )}
                  {isMaxed && (
                    <p className="text-xs text-destructive font-medium">
                      Limit reached
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Choose a Plan</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId
            return (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? 'border-primary shadow-md' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-1">
                    <span className="text-3xl font-bold">
                      {plan.price === 0
                        ? 'Free'
                        : `\u20B9${plan.price.toLocaleString('en-IN')}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        /month
                      </span>
                    )}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.id === 'enterprise' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleUpgrade('enterprise')}
                      disabled={checkoutMutation.isPending}
                    >
                      Contact Sales
                    </Button>
                  ) : plan.id === 'free' ? (
                    <Button variant="outline" className="w-full" disabled>
                      Downgrade not available
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending
                        ? 'Processing...'
                        : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoices</CardTitle>
          <CardDescription>Your billing history and invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No invoices yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice: any) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        {new Date(invoice.createdAt ?? invoice.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {invoice.invoiceNumber ?? invoice.id?.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {'\u20B9'}
                        {(invoice.amount ?? 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            invoiceStatusColors[invoice.status] ?? ''
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.invoiceUrl ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a
                              href={invoice.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {invoiceTotal > 10 && (
                <div className="flex items-center justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={invoicePage <= 1}
                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {invoicePage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={invoicePage * 10 >= invoiceTotal}
                    onClick={() => setInvoicePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {currentPlanId !== 'free' && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg text-destructive">
                Danger Zone
              </CardTitle>
            </div>
            <CardDescription>
              Cancelling your subscription will downgrade your account to the Free
              plan at the end of the current billing period. You will lose access
              to Pro/Enterprise features and data beyond Free plan limits may
              become inaccessible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Cancel Subscription</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Subscription?</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to cancel your subscription? Your plan
                    will be downgraded to Free at the end of the current billing
                    period. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCancelOpen(false)}
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending
                      ? 'Cancelling...'
                      : 'Yes, Cancel'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
