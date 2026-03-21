'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Contact, Plus, Search, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomerCard } from '@/components/customer/customer-card'
import { CustomerDetailSheet } from '@/components/customer/customer-detail-sheet'
import { CustomerFormSheet } from '@/components/customer/customer-form-sheet'
import { CustomerUploadDialog } from '@/components/customer/customer-upload-dialog'

function CustomerSkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export default function CustomersPage() {
  const { currentWorkspaceId } = useAuthStore()

  // Search
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Pagination
  const [page, setPage] = useState(1)
  const limit = 12

  // Sheet state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  // Customers list query
  const customersQuery = trpc.customer.list.useQuery(
    {
      workspaceId: currentWorkspaceId!,
      search: debouncedSearch || undefined,
      page,
      limit,
    },
    { enabled: !!currentWorkspaceId }
  )

  const customers = customersQuery.data?.data ?? []
  const totalPages = customersQuery.data?.totalPages ?? 0
  const total = customersQuery.data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your customer directory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            Upload
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {customersQuery.isLoading ? (
        <CustomerSkeletons />
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Contact className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No customers yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Add your first customer to start building your directory.
          </p>
          <Button className="mt-6" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Add your first customer
          </Button>
        </div>
      ) : (
        <>
          {/* Customer grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer as any}
                onClick={() => setSelectedCustomerId(customer.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}–
                {Math.min(page * limit, total)} of {total} customers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      <CustomerDetailSheet
        customerId={selectedCustomerId}
        open={!!selectedCustomerId}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomerId(null)
        }}
      />

      {/* Form sheet */}
      <CustomerFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <CustomerUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  )
}
