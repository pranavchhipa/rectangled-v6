'use client'

import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Pencil, Trash2, Star, User, Mail, Phone, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CustomerFormSheet } from './customer-form-sheet'

interface CustomerDetailSheetProps {
  customerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ReviewItem({ review }: { review: any }) {
  let reviewDate = ''
  try {
    reviewDate = format(new Date(review.reviewedAt), 'MMM d, yyyy')
  } catch {
    // ignore
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`size-3.5 ${
                i < (review.rating ?? 0)
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-muted text-muted'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{reviewDate}</span>
      </div>
      {review.text && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {review.text}
        </p>
      )}
    </div>
  )
}

export function CustomerDetailSheet({
  customerId,
  open,
  onOpenChange,
}: CustomerDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const utils = trpc.useUtils()

  const customerQuery = trpc.customer.getById.useQuery(
    { customerId: customerId! },
    { enabled: !!customerId && open }
  )

  const reviewsQuery = trpc.customer.getReviews.useQuery(
    { customerId: customerId!, page: 1, limit: 10 },
    { enabled: !!customerId && open }
  )

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      toast.success('Customer deleted successfully')
      utils.customer.list.invalidate()
      onOpenChange(false)
      setConfirmDelete(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete customer')
      setConfirmDelete(false)
    },
  })

  const customer = customerQuery.data
  const reviews = reviewsQuery.data?.data ?? []

  let lastSeen = ''
  if (customer?.lastSeenAt) {
    try {
      lastSeen = formatDistanceToNow(new Date(customer.lastSeenAt), {
        addSuffix: true,
      })
    } catch {
      // ignore
    }
  }

  let firstSeen = ''
  if (customer?.firstSeenAt) {
    try {
      firstSeen = format(new Date(customer.firstSeenAt), 'MMM d, yyyy')
    } catch {
      // ignore
    }
  }

  const handleDelete = () => {
    if (!customerId) return
    deleteMutation.mutate({ customerId })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md lg:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Customer Details</SheetTitle>
          </SheetHeader>

          {customerQuery.isLoading ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : customer ? (
            <div className="mt-6 space-y-6">
              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
              </div>

              {/* Customer info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <User className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">{customer.name}</p>
                    {lastSeen && (
                      <span className="text-xs text-muted-foreground">
                        Last seen {lastSeen}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{customer.phone}</span>
                    </div>
                  )}
                  {firstSeen && (
                    <div className="flex items-center gap-2">
                      <Tag className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Customer since {firstSeen}
                      </span>
                    </div>
                  )}
                </div>

                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {customer.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Reviews section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Reviews
                  {reviewsQuery.data?.total != null && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({reviewsQuery.data.total})
                    </span>
                  )}
                </h3>

                {reviewsQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No reviews from this customer yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reviews.map((review: any) => (
                      <ReviewItem key={review.id} review={review} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Customer not found.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit form sheet */}
      {customer && (
        <CustomerFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          customer={customer as any}
        />
      )}
    </>
  )
}
