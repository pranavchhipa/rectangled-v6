'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  CreditCard,
  Check,
  X,
  Sparkles,
  FileText,
  Receipt,
} from 'lucide-react'

// TODO: Replace placeholder data with tRPC billing calls when API is ready
// e.g., trpc.billing.getCurrentPlan.useQuery(...)
// e.g., trpc.billing.getInvoices.useQuery(...)
// e.g., trpc.billing.upgrade.useMutation(...)

const currentPlan = {
  name: 'Free Plan',
  price: '$0',
  period: 'forever',
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: [
      { label: 'Up to 3 locations', included: true },
      { label: '100 reviews/month', included: true },
      { label: 'Basic analytics', included: true },
      { label: 'AI review responses', included: false },
      { label: 'Custom branding', included: false },
      { label: 'Priority support', included: false },
    ],
    current: true,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    features: [
      { label: 'Up to 25 locations', included: true },
      { label: 'Unlimited reviews', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'AI review responses', included: true },
      { label: 'Custom branding', included: true },
      { label: 'Priority support', included: false },
    ],
    current: false,
  },
  {
    name: 'Enterprise',
    price: '$149',
    period: '/month',
    features: [
      { label: 'Unlimited locations', included: true },
      { label: 'Unlimited reviews', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'AI review responses', included: true },
      { label: 'Custom branding', included: true },
      { label: 'Priority support', included: true },
    ],
    current: false,
  },
]

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your subscription and billing
          </p>
        </div>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{currentPlan.name}</p>
              <p className="text-sm text-muted-foreground">
                {currentPlan.price} — {currentPlan.period}
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.current ? 'border-primary ring-1 ring-primary' : ''}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {plan.current && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground'}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {plan.current ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    // TODO: Wire up to tRPC billing.upgrade mutation when API is ready
                    <Button
                      className="w-full"
                      disabled
                      title="Coming soon"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Upgrade — Coming Soon
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO: Replace with tRPC billing.getInvoices query */}
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No billing history</p>
            <p className="text-xs text-muted-foreground">
              Your invoices and payment history will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
