'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin,
  Contact,
  MessageSquare,
  Ticket,
  Search,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchQuery = trpc.workspace?.globalSearch?.useQuery?.(
    { workspaceId: currentWorkspaceId!, query: debouncedQuery },
    { enabled: !!currentWorkspaceId && debouncedQuery.length >= 2 }
  )

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const navigate = (path: string) => {
    router.push(path)
    onOpenChange(false)
  }

  const results = searchQuery?.data
  const hasResults = results && (
    results.locations.length > 0 ||
    results.customers.length > 0 ||
    results.reviews.length > 0 ||
    results.coupons.length > 0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg">
        <div className="flex items-center border-b px-3">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search customers, reviews, locations, coupons..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none"
            autoFocus
          />
          {searchQuery?.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {searchQuery?.isLoading && (
              <p className="text-sm text-muted-foreground p-4 text-center">Searching...</p>
            )}

            {!searchQuery?.isLoading && !hasResults && (
              <p className="text-sm text-muted-foreground p-4 text-center">No results found</p>
            )}

            {results?.locations && results.locations.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Locations</p>
                {results.locations.map((loc: any) => (
                  <button
                    key={loc.id}
                    onClick={() => navigate('/dashboard/locations')}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <MapPin className="size-4 text-muted-foreground shrink-0" />
                    <span>{loc.name}</span>
                    {loc.city && <span className="text-muted-foreground">- {loc.city}</span>}
                  </button>
                ))}
              </div>
            )}

            {results?.customers && results.customers.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Customers</p>
                {results.customers.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => navigate('/dashboard/customers')}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <Contact className="size-4 text-muted-foreground shrink-0" />
                    <span>{c.name}</span>
                    {c.email && <span className="text-muted-foreground text-xs">({c.email})</span>}
                  </button>
                ))}
              </div>
            )}

            {results?.reviews && results.reviews.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Reviews</p>
                {results.reviews.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => navigate('/dashboard/inbox')}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <MessageSquare className="size-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{r.reviewerName}: {r.text?.slice(0, 60)}...</span>
                  </button>
                ))}
              </div>
            )}

            {results?.coupons && results.coupons.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Coupons</p>
                {results.coupons.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => navigate('/dashboard/coupons')}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <Ticket className="size-4 text-muted-foreground shrink-0" />
                    <span>{c.name}</span>
                    <span className="text-muted-foreground text-xs">({c.codePrefix})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl</kbd>
            {' + '}
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">K</kbd>
            {' to toggle search'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
