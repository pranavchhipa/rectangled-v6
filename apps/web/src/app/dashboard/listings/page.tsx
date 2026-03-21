'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Building2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  Store,
  CheckCircle2,
  XCircle,
  Globe,
  Shield,
  Undo2,
  Eye,
  Wifi,
  WifiOff,
} from 'lucide-react'

export default function ListingsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)

  const listingsQuery = trpc.listing.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const changesQuery = trpc.listing.getChanges.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const syncMutation = trpc.listing.syncListing.useMutation({
    onSuccess: () => {
      toast.success('Listing sync initiated')
      utils.listing.list.invalidate()
    },
    onError: () => {
      toast.error('Failed to sync listing')
    },
  })

  const resolveChangeMutation = trpc.listing.resolveChange?.useMutation?.({
    onSuccess: () => {
      toast.success('Change authorized')
      utils.listing.getChanges.invalidate()
    },
    onError: () => {
      toast.error('Failed to resolve change')
    },
  }) ?? null

  const allChanges = changesQuery.data ?? []
  const unresolvedChanges = allChanges.filter?.((c: any) => c.status === 'unresolved' || !c.status)?.length ?? allChanges.length ?? 0
  const listings = listingsQuery.data ?? []

  // Changes for selected listing
  const selectedListingChanges = selectedListingId
    ? allChanges.filter?.((c: any) => c.listingId === selectedListingId) ?? []
    : allChanges

  // Is listing stale? (not synced in the last 7 days)
  const isStale = (lastSynced: string | null | undefined) => {
    if (!lastSynced) return true
    const syncDate = new Date(lastSynced)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return syncDate < weekAgo
  }

  // Platform icon color
  const platformColor = (platform: string | undefined) => {
    switch (platform) {
      case 'google': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40'
      case 'zomato': return 'text-red-600 bg-red-50 dark:bg-red-950/40'
      default: return 'text-primary bg-primary/10'
    }
  }

  // Count changes per listing
  const changesCountByListing = new Map<string, number>()
  for (const c of allChanges as any[]) {
    const lid = c.listingId ?? ''
    changesCountByListing.set(lid, (changesCountByListing.get(lid) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your business listings across platforms
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/listings/posts">
            Manage Posts
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Change alerts banner */}
      {unresolvedChanges > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Unauthorized changes detected
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {unresolvedChanges} listing change{unresolvedChanges !== 1 ? 's' : ''} need your review and authorization
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              onClick={() => setSelectedListingId('__all__')}
            >
              <Eye className="w-4 h-4 mr-1" />
              View All Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {listingsQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!listingsQuery.isLoading && listings.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
              <Store className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No listings found</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Connect a platform to start managing your business listings and detect unauthorized changes.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/connectors">
                <Globe className="w-4 h-4 mr-1" />
                Connect Platform
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Listings grid */}
      {!listingsQuery.isLoading && listings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing: any) => {
            const stale = isStale(listing.lastSyncedAt)
            const changeCount = changesCountByListing.get(listing.id) ?? 0

            return (
              <Card key={listing.id} className="hover:shadow-md transition-all group">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${platformColor(listing.platform)}`}>
                      {listing.platform === 'google' ? (
                        <Globe className="w-5 h-5" />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{listing.name ?? listing.businessName ?? 'Unnamed'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {listing.platform && (
                          <Badge variant="secondary" className="text-xs">
                            {listing.platform}
                          </Badge>
                        )}
                        {/* Sync status indicator */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            stale
                              ? 'text-orange-600 border-orange-200 dark:border-orange-800'
                              : 'text-green-600 border-green-200 dark:border-green-800'
                          }`}
                        >
                          {stale ? (
                            <WifiOff className="size-2.5" />
                          ) : (
                            <Wifi className="size-2.5" />
                          )}
                          {stale ? 'Stale' : 'Synced'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {listing.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{listing.address}</span>
                    </div>
                  )}

                  {listing.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{listing.phone}</span>
                    </div>
                  )}

                  {listing.lastSyncedAt && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>Last synced {new Date(listing.lastSyncedAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/dashboard/listings/${listing.id}`}>
                        View Details
                      </Link>
                    </Button>
                    {changeCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                        onClick={() => setSelectedListingId(listing.id)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Changes
                        <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                          {changeCount}
                        </Badge>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncMutation.mutate({ listingId: listing.id })}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Change Log Panel */}
      <Sheet
        open={!!selectedListingId}
        onOpenChange={(open) => {
          if (!open) setSelectedListingId(null)
        }}
      >
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="size-5 text-amber-600" />
              Change Log
              {selectedListingChanges.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedListingChanges.length} change{selectedListingChanges.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {changesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : selectedListingChanges.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-lg">No changes detected</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  All listing data is consistent with your authorized information.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Field</TableHead>
                      <TableHead className="font-semibold">Previous</TableHead>
                      <TableHead className="font-semibold">New Value</TableHead>
                      <TableHead className="font-semibold">Detected</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedListingChanges.map((change: any, idx: number) => {
                      const isUnresolved = change.status === 'unresolved' || !change.status
                      return (
                        <TableRow
                          key={change.id ?? idx}
                          className={isUnresolved ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
                        >
                          <TableCell className="font-medium text-sm">
                            {change.field ?? change.fieldName ?? 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                            {change.previousValue ?? change.oldValue ?? '\u2014'}
                          </TableCell>
                          <TableCell className={`text-sm max-w-[140px] truncate ${isUnresolved ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                            {change.newValue ?? '\u2014'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {change.detectedAt ?? change.createdAt
                              ? new Date(change.detectedAt ?? change.createdAt).toLocaleDateString()
                              : '\u2014'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isUnresolved ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {isUnresolved ? 'Unresolved' : change.status ?? 'Resolved'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isUnresolved && (
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => {
                                    if (resolveChangeMutation) {
                                      resolveChangeMutation.mutate({
                                        changeId: change.id,
                                        action: 'authorize',
                                      })
                                    } else {
                                      toast.info('Authorize feature coming soon')
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="size-3" />
                                  Authorize
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    if (resolveChangeMutation) {
                                      resolveChangeMutation.mutate({
                                        changeId: change.id,
                                        action: 'revert',
                                      })
                                    } else {
                                      toast.info('Revert feature coming soon')
                                    }
                                  }}
                                >
                                  <Undo2 className="size-3" />
                                  Revert
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
