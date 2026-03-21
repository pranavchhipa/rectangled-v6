'use client'

import { useParams, useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Globe,
  Clock,
  Tag,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listingId = params.id as string
  const utils = trpc.useUtils()

  const listingQuery = trpc.listing.getById.useQuery(
    { id: listingId },
    { enabled: !!listingId }
  )

  const resolveMutation = trpc.listing.resolveChange.useMutation({
    onSuccess: () => {
      toast.success('Change resolved')
      utils.listing.getById.invalidate()
    },
    onError: () => {
      toast.error('Failed to resolve change')
    },
  })

  const listing = listingQuery.data
  const changes = (listing as any)?.changes ?? []

  // NAP consistency check (placeholder logic)
  const napConsistent = listing
    ? !!(listing as any).name && !!(listing as any).address && !!(listing as any).phone
    : false

  if (listingQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">Listing not found</h3>
            <p className="text-sm text-muted-foreground">
              This listing may have been removed or you don&apos;t have access.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {(listing as any).name ?? (listing as any).businessName ?? 'Listing Detail'}
          </h1>
          {(listing as any).platform && (
            <Badge variant="secondary" className="mt-1">
              {(listing as any).platform}
            </Badge>
          )}
        </div>
      </div>

      {/* NAP Consistency Indicator */}
      <Card className={napConsistent ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}>
        <CardContent className="p-4 flex items-center gap-3">
          {napConsistent ? (
            <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${napConsistent ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
              NAP Consistency: {napConsistent ? 'Consistent' : 'Incomplete'}
            </p>
            <p className={`text-xs ${napConsistent ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {napConsistent
                ? 'Name, Address, and Phone are present across this listing'
                : 'Some NAP fields are missing — review listing details'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Listing Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listing Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Business Name</p>
                <p className="text-sm font-medium">{(listing as any).name ?? (listing as any).businessName ?? 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{(listing as any).address ?? 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{(listing as any).phone ?? 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Website</p>
                <p className="text-sm font-medium">{(listing as any).website ?? 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Categories</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(listing as any).categories?.length > 0 ? (
                    (listing as any).categories.map((cat: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {cat}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No categories</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Business Hours</p>
                <p className="text-sm font-medium">{(listing as any).hours ?? 'Not specified'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Log</CardTitle>
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No unresolved changes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {changes.map((change: any) => (
                <div
                  key={change.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {change.field}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(change.detectedAt ?? change.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="line-through text-muted-foreground truncate">
                        {change.oldValue ?? 'N/A'}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium truncate">{change.newValue ?? 'N/A'}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3 shrink-0"
                    onClick={() => resolveMutation.mutate({ changeId: change.id })}
                    disabled={resolveMutation.isPending}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
