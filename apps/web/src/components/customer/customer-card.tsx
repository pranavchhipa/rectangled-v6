'use client'

import { formatDistanceToNow } from 'date-fns'
import { User, Mail, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface CustomerData {
  id: string
  name: string
  email: string | null
  phone: string | null
  tags: string[]
  lastSeenAt: string | null
}

interface CustomerCardProps {
  customer: CustomerData
  onClick: () => void
}

export function CustomerCard({ customer, onClick }: CustomerCardProps) {
  let lastSeen = ''
  if (customer.lastSeenAt) {
    try {
      lastSeen = formatDistanceToNow(new Date(customer.lastSeenAt), {
        addSuffix: true,
      })
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted shrink-0">
          <User className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{customer.name}</p>
          {customer.email && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail className="size-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {customer.email}
              </span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="size-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {customer.phone}
              </span>
            </div>
          )}
        </div>
      </div>

      {customer.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {customer.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {lastSeen && (
        <p className="mt-3 text-xs text-muted-foreground">
          Last seen {lastSeen}
        </p>
      )}
    </button>
  )
}
