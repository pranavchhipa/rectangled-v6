# Sub-Project 1: Quick UI Fixes & Data Display — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 14 UI issues and data display problems across Dashboard, Locations, Inbox, Escalations, Analytics, Automations, Settings, and Customers pages.

**Architecture:** Frontend-first fixes using existing tRPC patterns. DB schema changes for locations (ownerName) and escalations (ticketNumber, activityLog). New shared UI components (InfoTooltip, DateRangePicker, PlatformIcons). All queries remain workspace-scoped via existing auth patterns.

**Tech Stack:** Next.js 15 + shadcn/ui + TailwindCSS v4, NestJS + tRPC + Drizzle ORM, PostgreSQL 16

**Spec:** `docs/superpowers/specs/2026-03-21-subproject1-quick-fixes-design.md`

---

## Chunk 1: Shared Components & DB Schema Changes

### Task 1: Create InfoTooltip Component

**Files:**
- Create: `apps/web/src/components/ui/info-tooltip.tsx`

- [ ] **Step 1: Create the InfoTooltip component**

```tsx
// apps/web/src/components/ui/info-tooltip.tsx
'use client'

import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface InfoTooltipProps {
  text: string
  className?: string
}

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors ${className ?? ''}`}
            aria-label="More info"
          >
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Verify component renders**

Visually check — this is a simple presentational component. Will be integrated in Task 10 (Analytics).

---

### Task 2: Create DateRangePicker Component

**Files:**
- Create: `apps/web/src/components/ui/date-range-picker.tsx`

**Dependencies:** shadcn Calendar and Popover components should already exist. If not, install them.

- [ ] **Step 1: Check if Calendar component exists**

Run: `ls apps/web/src/components/ui/calendar.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"`

If MISSING, run: `cd apps/web && npx shadcn@latest add calendar`

- [ ] **Step 2: Create the DateRangePicker component**

```tsx
// apps/web/src/components/ui/date-range-picker.tsx
'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'

type PresetKey = 'today' | '7d' | '14d' | '30d' | '90d' | 'all'

interface DateRangePickerProps {
  dateRange: { from?: Date; to?: Date }
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void
  presets?: PresetKey[]
  className?: string
}

const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Today',
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
}

function getPresetRange(key: PresetKey): { from?: Date; to?: Date } {
  const now = new Date()
  const to = now
  switch (key) {
    case 'today':
      return { from: new Date(now.setHours(0, 0, 0, 0)), to }
    case '7d':
      return { from: new Date(Date.now() - 7 * 86400000), to }
    case '14d':
      return { from: new Date(Date.now() - 14 * 86400000), to }
    case '30d':
      return { from: new Date(Date.now() - 30 * 86400000), to }
    case '90d':
      return { from: new Date(Date.now() - 90 * 86400000), to }
    case 'all':
      return { from: undefined, to: undefined }
  }
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  presets = ['7d', '14d', '30d', '90d', 'all'],
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const handlePreset = (key: PresetKey) => {
    onDateRangeChange(getPresetRange(key))
    setOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onDateRangeChange({ from: range?.from, to: range?.to })
  }

  const displayText =
    dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
      : dateRange.from
        ? `${format(dateRange.from, 'MMM d, yyyy')} -`
        : 'All time'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`justify-start text-left font-normal ${className ?? ''}`}
        >
          <CalendarIcon className="mr-2 size-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-3">
            {presets.map((key) => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(key)}
              >
                {PRESET_LABELS[key]}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Install date-fns if missing**

Run: `cd apps/web && npm ls date-fns 2>/dev/null || npm install date-fns`

---

### Task 3: Create PlatformIcons Component

**Files:**
- Create: `apps/web/src/components/ui/platform-icons.tsx`

- [ ] **Step 1: Create platform icon components**

```tsx
// apps/web/src/components/ui/platform-icons.tsx

interface IconProps {
  className?: string
}

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function ZomatoIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#E23744" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        Z
      </text>
    </svg>
  )
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
        fill="#1877F2"
      />
    </svg>
  )
}

const PLATFORM_ICONS: Record<string, React.ComponentType<IconProps>> = {
  google: GoogleIcon,
  gbp: GoogleIcon,
  zomato: ZomatoIcon,
  facebook: FacebookIcon,
}

interface PlatformIconBadgeProps {
  platform: string
  size?: number
}

export function PlatformIconBadge({ platform, size = 16 }: PlatformIconBadgeProps) {
  const Icon = PLATFORM_ICONS[platform.toLowerCase()]
  if (!Icon) return null
  return <Icon className={`shrink-0`} style={{ width: size, height: size }} />
}

export function PlatformIconRow({ platforms }: { platforms: string[] }) {
  const unique = [...new Set(platforms.map((p) => p.toLowerCase()))]
  if (unique.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        No platforms connected
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      {unique.map((p) => (
        <PlatformIconBadge key={p} platform={p} size={16} />
      ))}
    </div>
  )
}
```

---

### Task 4: DB Schema Changes — Locations ownerName

**Files:**
- Modify: `packages/db/src/schema/locations.ts`
- Modify: `packages/shared/src/validators/location.ts`

- [ ] **Step 1: Add ownerName column to locations schema**

In `packages/db/src/schema/locations.ts`, add after the `email` field:

```typescript
ownerName: varchar('owner_name', { length: 255 }),
```

- [ ] **Step 2: Update location validators**

In `packages/shared/src/validators/location.ts`, add `ownerName` to both schemas:

Add to `createLocationSchema`:
```typescript
ownerName: z.string().max(255).optional(),
```

Add to `updateLocationSchema`:
```typescript
ownerName: z.string().max(255).optional(),
```

- [ ] **Step 3: Update location service to handle ownerName**

In `apps/api/src/location/location.service.ts`, ensure the `create` and `update` methods pass through `ownerName`. Check the service — if it uses spread for input fields, no change needed. If it manually lists fields, add `ownerName`.

- [ ] **Step 4: Rebuild shared package and push DB schema**

```bash
cd packages/shared && npm run build
cd ../db && DATABASE_URL="postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6" npx drizzle-kit push
```

---

### Task 5: DB Schema Changes — Escalations Ticket System

**Files:**
- Modify: `packages/db/src/schema/enums.ts`
- Modify: `packages/db/src/schema/cx-routing.ts`

- [ ] **Step 1: Add 'closed' to escalation status enum**

In `packages/db/src/schema/enums.ts`, change line 93:

```typescript
// Before:
export const escalationStatusEnum = pgEnum('escalation_status', ['open', 'in_progress', 'resolved', 'expired'])

// After:
export const escalationStatusEnum = pgEnum('escalation_status', ['open', 'in_progress', 'resolved', 'expired', 'closed'])
```

- [ ] **Step 2: Add ticketNumber and activityLog columns to escalations**

In `packages/db/src/schema/cx-routing.ts`, add after the `notes` field (line 71):

```typescript
ticketNumber: integer('ticket_number'),
activityLog: jsonb('activity_log').$type<Array<{ text: string; authorId: string; authorName: string; timestamp: string }>>().default([]).notNull(),
```

- [ ] **Step 3: Push DB schema**

```bash
cd packages/db && DATABASE_URL="postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6" npx drizzle-kit push
```

- [ ] **Step 4: Rebuild shared package**

```bash
npm run build --workspace=packages/shared
```

---

## Chunk 2: Dashboard Fixes

### Task 6: Remove "System Healthy" Indicator

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Remove the System Healthy div**

In `apps/web/src/app/dashboard/page.tsx`, remove lines 110-115 (the div containing "System healthy"):

```tsx
// DELETE this entire block:
            <div className="hidden sm:flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-primary">
                System healthy
              </span>
            </div>
```

---

### Task 7: Global Search Command Palette

**Files:**
- Create: `apps/web/src/components/dashboard/global-search.tsx`
- Modify: `apps/web/src/components/dashboard/header.tsx`
- Modify: `apps/api/src/workspace/workspace.service.ts`
- Modify: `apps/api/src/workspace/workspace.router.ts`

- [ ] **Step 1: Add globalSearch method to workspace service**

In `apps/api/src/workspace/workspace.service.ts`, add this import at the top:

```typescript
import { reviews, customers, locations, couponTemplates } from '@rectangled/db'
import { or, like, sql } from 'drizzle-orm'
```

Then add this method to the `WorkspaceService` class:

```typescript
  async globalSearch(workspaceId: string, query: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const searchTerm = `%${query}%`
    const limit = 5

    const [locationResults, customerResults, reviewResults, couponResults] = await Promise.all([
      this.db
        .select({ id: locations.id, name: locations.name, city: locations.city })
        .from(locations)
        .where(and(
          eq(locations.workspaceId, workspaceId),
          or(like(locations.name, searchTerm), like(locations.city, searchTerm))
        ))
        .limit(limit),

      this.db
        .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
        .from(customers)
        .where(and(
          eq(customers.workspaceId, workspaceId),
          or(
            like(customers.name, searchTerm),
            like(customers.email, searchTerm),
            like(customers.phone, searchTerm)
          )
        ))
        .limit(limit),

      this.db
        .select({ id: reviews.id, reviewerName: reviews.reviewerName, text: reviews.text, platform: reviews.platform })
        .from(reviews)
        .where(and(
          eq(reviews.workspaceId, workspaceId),
          or(
            like(reviews.reviewerName, searchTerm),
            like(reviews.text, searchTerm)
          )
        ))
        .limit(limit),

      this.db
        .select({ id: couponTemplates.id, name: couponTemplates.name, codePrefix: couponTemplates.codePrefix })
        .from(couponTemplates)
        .where(and(
          eq(couponTemplates.workspaceId, workspaceId),
          or(
            like(couponTemplates.name, searchTerm),
            like(couponTemplates.codePrefix, searchTerm)
          )
        ))
        .limit(limit),
    ])

    return {
      locations: locationResults,
      customers: customerResults,
      reviews: reviewResults,
      coupons: couponResults,
    }
  }
```

- [ ] **Step 2: Add globalSearch procedure to workspace router**

In `apps/api/src/workspace/workspace.router.ts`, add:

```typescript
    globalSearch: protectedProcedure
      .input(z.object({
        workspaceId: z.string().uuid(),
        query: z.string().min(2).max(200),
      }))
      .query(async ({ input, ctx }) => {
        return workspaceService.globalSearch(input.workspaceId, input.query, ctx.user.sub)
      }),
```

- [ ] **Step 3: Create the GlobalSearch component**

```tsx
// apps/web/src/components/dashboard/global-search.tsx
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

  const searchQuery = trpc.workspace.globalSearch.useQuery(
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

  const results = searchQuery.data
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
          {searchQuery.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {searchQuery.isLoading && (
              <p className="text-sm text-muted-foreground p-4 text-center">Searching...</p>
            )}

            {!searchQuery.isLoading && !hasResults && (
              <p className="text-sm text-muted-foreground p-4 text-center">No results found</p>
            )}

            {results?.locations && results.locations.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Locations</p>
                {results.locations.map((loc) => (
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
                {results.customers.map((c) => (
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
                {results.reviews.map((r) => (
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
                {results.coupons.map((c) => (
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
```

- [ ] **Step 4: Update header to use GlobalSearch**

Replace the contents of `apps/web/src/components/dashboard/header.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LogOut, Settings } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { GlobalSearch } from '@/components/dashboard/global-search'

export function DashboardHeader() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [searchOpen, setSearchOpen] = useState(false)

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? 'U'

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <>
      <header className="h-14 bg-background border-b border-border flex items-center gap-3 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 flex-1 max-w-md cursor-pointer hover:bg-muted/80 transition-colors"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search...</span>
          <kbd className="ml-auto hidden sm:inline-flex rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Ctrl K
          </kbd>
        </button>

        <div className="flex-1" />

        {/* Notifications */}
        <NotificationBell />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
```

---

## Chunk 3: Locations Page Fixes

### Task 8: Location Cards — Show Connector Icons + Owner Name

**Files:**
- Modify: `apps/web/src/components/location/location-card.tsx`
- Modify: `apps/web/src/app/dashboard/locations/page.tsx`
- Modify: `apps/web/src/components/location/location-form-sheet.tsx`

- [ ] **Step 1: Update LocationCard to accept and display connectors + ownerName**

In `apps/web/src/components/location/location-card.tsx`:

Add import at top:
```tsx
import { PlatformIconRow } from '@/components/ui/platform-icons'
import { User } from 'lucide-react'
```

Update `LocationData` interface to include:
```tsx
ownerName?: string | null
connectedPlatforms?: string[]
```

Add after the email display section (before the actions row):
```tsx
          {/* Owner */}
          {location.ownerName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="size-4 shrink-0" />
              <span>{location.ownerName}</span>
            </div>
          )}

          {/* Connected platforms */}
          <div className="flex items-center gap-2 text-sm">
            <PlatformIconRow platforms={location.connectedPlatforms ?? []} />
          </div>
```

- [ ] **Step 2: Update locations page to pass connector data**

In `apps/web/src/app/dashboard/locations/page.tsx`, add a connector query:

```tsx
  const connectorsQuery = trpc.connector.listInstances.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Build location-to-platform mapping
  const locationPlatforms = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const conn of connectorsQuery.data ?? []) {
      const locId = conn.locationId
      if (locId) {
        if (!map[locId]) map[locId] = []
        map[locId].push(conn.connectorTypeId)
      }
    }
    return map
  }, [connectorsQuery.data])
```

Add `useMemo` to imports. Then where `LocationCard` is rendered, pass:
```tsx
<LocationCard
  location={{
    ...loc,
    connectedPlatforms: locationPlatforms[loc.id] ?? [],
  }}
/>
```

- [ ] **Step 3: Add ownerName field to LocationFormSheet**

In `apps/web/src/components/location/location-form-sheet.tsx`:

Add `ownerName` to `FormState` interface and `defaultFormState`:
```tsx
interface FormState {
  name: string
  ownerName: string
  address: string
  // ... rest
}

const defaultFormState: FormState = {
  name: '',
  ownerName: '',
  address: '',
  // ... rest
}
```

In the `useEffect` that populates the form, add:
```tsx
ownerName: location.ownerName ?? '',
```

In `handleSubmit`, pass `ownerName` to both create and update mutations:
```tsx
ownerName: form.ownerName || undefined,
```

Add the form field after the Name field:
```tsx
          {/* Store Owner Name */}
          <div className="space-y-2">
            <Label htmlFor="location-owner">Store Owner Name</Label>
            <Input
              id="location-owner"
              placeholder="e.g. Rajesh Kumar"
              value={form.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
            />
          </div>
```

---

## Chunk 4: Inbox Page Fixes

### Task 9: Inbox — Show Location + Date, Fix Search, Granular Date Filter

**Files:**
- Modify: `apps/web/src/app/dashboard/inbox/page.tsx`
- Modify: `apps/api/src/review/review.service.ts`

- [ ] **Step 1: Enhance review search in backend**

In `apps/api/src/review/review.service.ts`, update the search condition in the `list` method (around line 267):

```typescript
// Before:
    if (input.search) {
      conditions.push(like(reviews.text, `%${input.search}%`))
    }

// After:
    if (input.search) {
      conditions.push(
        or(
          like(reviews.text, `%${input.search}%`),
          like(reviews.reviewerName, `%${input.search}%`)
        )!
      )
    }
```

- [ ] **Step 2: Add location name to review list response**

In `apps/api/src/review/review.service.ts`, modify the `list` method to join location names. After the data query (around line 279-286), add:

```typescript
    // Fetch location names for the reviews
    const locationIds = [...new Set(data.map(r => r.locationId).filter(Boolean))]
    const locationNames: Map<string, string> = new Map()
    if (locationIds.length > 0) {
      const locs = await this.db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(sql`${locations.id} IN ${locationIds}`)
      for (const loc of locs) {
        locationNames.set(loc.id, loc.name)
      }
    }
```

Then update the return mapping:
```typescript
    return {
      data: data.map((r) => ({
        ...r,
        locationName: r.locationId ? locationNames.get(r.locationId) ?? null : null,
        latestResponse: responsesMap.get(r.id) ?? null,
      })),
      // ...
    }
```

- [ ] **Step 3: Update inbox page — add location badge, date display, fix search, granular date filter**

In `apps/web/src/app/dashboard/inbox/page.tsx`:

Add imports:
```tsx
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { PlatformIconBadge } from '@/components/ui/platform-icons'
import { formatDistanceToNow, format } from 'date-fns'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
```

Replace the `DateRange` type and state:
```tsx
// Replace:
type DateRange = '7d' | '30d' | '90d' | 'all'

// With date range state:
const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
```

Wire search to the query — ensure the search state is passed as `search` param to `trpc.review.list`:
```tsx
const reviewsQuery = trpc.review.list.useQuery(
  {
    workspaceId: currentWorkspaceId!,
    search: debouncedSearch || undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    // ... other filters
  },
  { enabled: !!currentWorkspaceId }
)
```

Replace the old date range `<Select>` with:
```tsx
<DateRangePicker
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  presets={['today', '7d', '14d', '30d', '90d', 'all']}
/>
```

In each review card, add location name and date:
```tsx
{/* After the platform badge */}
{review.locationName && (
  <Badge variant="outline" className="text-xs">
    {review.locationName}
  </Badge>
)}
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="text-xs text-muted-foreground">
        {review.reviewedAt ? formatDistanceToNow(new Date(review.reviewedAt), { addSuffix: true }) : ''}
      </span>
    </TooltipTrigger>
    <TooltipContent>
      {review.reviewedAt ? format(new Date(review.reviewedAt), 'PPpp') : ''}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Chunk 5: Analytics Page Fixes

### Task 10: Analytics — Date Filter, Platform Filter, Info Tooltips

**Files:**
- Modify: `apps/web/src/app/dashboard/analytics/page.tsx`
- Modify: `packages/shared/src/validators/review.ts`

- [ ] **Step 1: Add platform field to analytics validator**

In `packages/shared/src/validators/review.ts`, update `reviewAnalyticsSchema`:

```typescript
export const reviewAnalyticsSchema = z.object({
  workspaceId: uuidSchema,
  locationId: uuidSchema.optional(),
  dateRange: z.enum(['7d', '30d', '90d', 'custom']).default('30d'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  platform: z.string().max(50).optional(),
})
```

Rebuild shared: `npm run build --workspace=packages/shared`

- [ ] **Step 2: Update analytics page — replace date filter, add platform filter, add tooltips**

In `apps/web/src/app/dashboard/analytics/page.tsx`:

Add imports:
```tsx
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { InfoTooltip } from '@/components/ui/info-tooltip'
```

Replace the `DateRange` type and `DATE_RANGE_OPTIONS` with:
```tsx
const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
  from: new Date(Date.now() - 30 * 86400000),
  to: new Date(),
})
const [platformFilter, setPlatformFilter] = useState<string>('all')
```

Replace the date `<Select>` in the page header with:
```tsx
<div className="flex items-center gap-2">
  <DateRangePicker
    dateRange={dateRange}
    onDateRangeChange={setDateRange}
    presets={['7d', '14d', '30d', '90d', 'all']}
  />
  <Select value={platformFilter} onValueChange={setPlatformFilter}>
    <SelectTrigger className="w-[140px]">
      <SelectValue placeholder="Platform" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Platforms</SelectItem>
      <SelectItem value="google">Google</SelectItem>
      <SelectItem value="zomato">Zomato</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Add `InfoTooltip` next to metric titles. Example for Health Score:
```tsx
<CardTitle className="flex items-center gap-1.5">
  Health Score
  <InfoTooltip text="Composite score based on rating, response rate, sentiment, and review velocity (0-100)" />
</CardTitle>
```

Apply similar tooltips for:
- NPS: "Net Promoter Score — how likely customers recommend your business (0-100)"
- CSAT: "Customer Satisfaction Score — direct happiness measure (1-5)"
- CLI: "Customer Loyalty Index — trust + satisfaction + advocacy composite (0-100)"
- NEV: "Net Emotional Value — positive vs negative emotion ratio (-100 to +100)"
- Sentiment: "Overall emotional tone — positive, negative, neutral, or mixed"
- Aspects: "Business elements customers mention — food, service, ambiance, etc."

---

## Chunk 6: Automations Rename + Sidebar Updates

### Task 11: Rename Automations to "Post-Review Actions"

**Files:**
- Modify: `apps/web/src/app/dashboard/automations/page.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Update sidebar nav label**

In `apps/web/src/components/dashboard/sidebar.tsx`, change line 60:

```tsx
// Before:
  { label: 'Automations', href: '/dashboard/automations', icon: Zap },

// After:
  { label: 'Post-Review Actions', href: '/dashboard/automations', icon: Zap },
```

- [ ] **Step 2: Remove Billing and Admin from sidebar**

In the same file, remove these two lines (66-68):

```tsx
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Admin', href: '/dashboard/admin', icon: Shield },
```

Also remove the unused imports `CreditCard` and `Shield` from lucide-react.

- [ ] **Step 3: Update automations page title**

In `apps/web/src/app/dashboard/automations/page.tsx`, find the page title (likely `<h1>`) and change "Automations" to "Post-Review Actions". Also update any subtitle/description text.

---

## Chunk 7: Settings Merge (Settings + Billing + Admin)

### Task 12: Merge Settings, Billing, Admin into Tabbed Settings Page

**Files:**
- Modify: `apps/web/src/app/dashboard/settings/page.tsx`
- Modify: `apps/web/src/app/dashboard/billing/page.tsx` (redirect)
- Modify: `apps/web/src/app/dashboard/admin/page.tsx` (redirect)

- [ ] **Step 1: Read the full billing and admin pages**

Read the complete content of:
- `apps/web/src/app/dashboard/billing/page.tsx`
- `apps/web/src/app/dashboard/admin/page.tsx`

- [ ] **Step 2: Add billing and admin tabs to settings page**

In `apps/web/src/app/dashboard/settings/page.tsx`:

Add `useSearchParams` import:
```tsx
import { useSearchParams } from 'next/navigation'
```

Add state for active tab based on URL params:
```tsx
const searchParams = useSearchParams()
const initialTab = searchParams.get('tab') || 'general'
```

Set the initial value on `<Tabs>`:
```tsx
<Tabs defaultValue={initialTab} className="...">
```

Add the Billing and Admin tab triggers and content:
```tsx
<TabsTrigger value="billing">
  <CreditCard className="w-4 h-4 mr-1.5" /> Billing
</TabsTrigger>
<TabsTrigger value="admin">
  <Shield className="w-4 h-4 mr-1.5" /> Admin
</TabsTrigger>
```

Move the billing page content into a `<TabsContent value="billing">` and admin content into `<TabsContent value="admin">`.

- [ ] **Step 3: Set up redirects from /billing and /admin**

Replace `apps/web/src/app/dashboard/billing/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function BillingPage() {
  redirect('/dashboard/settings?tab=billing')
}
```

Replace `apps/web/src/app/dashboard/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function AdminPage() {
  redirect('/dashboard/settings?tab=admin')
}
```

Note: Remove `'use client'` from these files since `redirect()` works in server components.

---

## Chunk 8: Customer Bulk Upload

### Task 13: Customer Bulk Upload

**Files:**
- Create: `apps/web/src/components/customer/customer-upload-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/customers/page.tsx`
- Modify: `apps/api/src/customer/customer.service.ts`
- Modify: `apps/api/src/customer/customer.router.ts`
- Modify: `packages/shared/src/validators/customer.ts`

- [ ] **Step 1: Install xlsx package**

```bash
cd apps/web && npm install xlsx
```

- [ ] **Step 2: Add bulkCreate validator**

In `packages/shared/src/validators/customer.ts`, add:

```typescript
export const bulkCreateCustomersSchema = z.object({
  workspaceId: uuidSchema,
  customers: z.array(z.object({
    name: z.string().min(1).max(255).trim(),
    email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
    phone: z.string().trim().optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
  })).min(1).max(1000),
})
```

Rebuild shared: `npm run build --workspace=packages/shared`

- [ ] **Step 3: Add bulkCreate method to customer service**

In `apps/api/src/customer/customer.service.ts`, add:

```typescript
  async bulkCreate(
    input: { workspaceId: string; customers: Array<{ name: string; email?: string; phone?: string; tags?: string[] }> },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const cust of input.customers) {
      try {
        // Check for duplicates by email or phone
        if (cust.email) {
          const existing = await this.db.query.customers.findFirst({
            where: and(
              eq(customers.workspaceId, input.workspaceId),
              eq(customers.email, cust.email)
            ),
          })
          if (existing) { skipped++; continue }
        }
        if (cust.phone) {
          const existing = await this.db.query.customers.findFirst({
            where: and(
              eq(customers.workspaceId, input.workspaceId),
              eq(customers.phone, cust.phone)
            ),
          })
          if (existing) { skipped++; continue }
        }

        await this.db.insert(customers).values({
          workspaceId: input.workspaceId,
          name: cust.name,
          email: cust.email || null,
          phone: cust.phone || null,
          tags: cust.tags ?? [],
        })
        created++
      } catch (err: any) {
        errors.push(`Row "${cust.name}": ${err.message}`)
      }
    }

    return { created, skipped, errors }
  }
```

- [ ] **Step 4: Add bulkCreate procedure to customer router**

In `apps/api/src/customer/customer.router.ts`, add import and procedure:

```typescript
import { bulkCreateCustomersSchema } from '@rectangled/shared'

// Add to the router:
    bulkCreate: protectedProcedure
      .input(bulkCreateCustomersSchema)
      .mutation(async ({ input, ctx }) => {
        return customerService.bulkCreate(input, ctx.user.sub)
      }),
```

- [ ] **Step 5: Create CustomerUploadDialog component**

```tsx
// apps/web/src/components/customer/customer-upload-dialog.tsx
'use client'

import { useState, useCallback } from 'react'
import { Upload, Download, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ParsedCustomer {
  name: string
  email?: string
  phone?: string
  tags?: string[]
}

interface CustomerUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_ROWS = 1000

export function CustomerUploadDialog({ open, onOpenChange }: CustomerUploadDialogProps) {
  const { currentWorkspaceId } = useAuthStore()
  const queryClient = useQueryClient()
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([])
  const [fileName, setFileName] = useState('')

  const bulkCreateMutation = trpc.customer.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.created} customers (${result.skipped} skipped)`)
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} errors occurred`)
      }
      queryClient.invalidateQueries({ queryKey: [['customer', 'list']] })
      onOpenChange(false)
      setParsedData([])
      setFileName('')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Email', 'Phone', 'Tags'],
      ['Priya Sharma', 'priya@example.com', '+919876543210', 'vip,regular'],
      ['Amit Patel', 'amit@example.com', '+919876543211', 'new'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')
    XLSX.writeFile(wb, 'customer_upload_sample.xlsx')
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum 5MB allowed.')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

        if (json.length > MAX_ROWS) {
          toast.error(`Too many rows (${json.length}). Maximum ${MAX_ROWS} allowed.`)
          return
        }

        const parsed: ParsedCustomer[] = json
          .filter((row) => row.Name || row.name)
          .map((row) => ({
            name: (row.Name || row.name || '').trim(),
            email: (row.Email || row.email || '').trim() || undefined,
            phone: (row.Phone || row.phone || '').trim() || undefined,
            tags: (row.Tags || row.tags || '')
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean),
          }))

        setParsedData(parsed)
      } catch {
        toast.error('Failed to parse file. Please check the format.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleImport = () => {
    if (!currentWorkspaceId || parsedData.length === 0) return
    bulkCreateMutation.mutate({
      workspaceId: currentWorkspaceId,
      customers: parsedData,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleDownloadSample}>
              <Download className="size-4 mr-1.5" />
              Download Sample XLSX
            </Button>
          </div>

          {parsedData.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted/50 transition-colors">
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload .csv or .xlsx file
              </p>
              <p className="text-xs text-muted-foreground">
                Max 5MB, up to 1000 rows
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {fileName} — {parsedData.length} customers
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setParsedData([]); setFileName('') }}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 20).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.email ?? '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.phone ?? '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.tags?.join(', ') ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 20 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    ...and {parsedData.length - 20} more rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedData.length === 0 || bulkCreateMutation.isPending}
          >
            {bulkCreateMutation.isPending ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-1.5" />
                Import {parsedData.length} Customers
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6: Add upload button to customers page**

In `apps/web/src/app/dashboard/customers/page.tsx`, add:

Import:
```tsx
import { Upload } from 'lucide-react'
import { CustomerUploadDialog } from '@/components/customer/customer-upload-dialog'
```

Add state:
```tsx
const [uploadOpen, setUploadOpen] = useState(false)
```

Add button next to "Add Customer":
```tsx
<Button variant="outline" onClick={() => setUploadOpen(true)}>
  <Upload className="size-4" />
  Upload
</Button>
```

Add dialog at the end of the component:
```tsx
<CustomerUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
```

---

## Chunk 9: Escalations Ticket System

### Task 14: Escalations — Show Location/Reviewer/Date + Ticket System

This is the largest task. It involves backend changes to the cx-routing service and a significant UI overhaul.

**Files:**
- Modify: `apps/api/src/cx-routing/cx-routing.service.ts`
- Modify: `apps/web/src/app/dashboard/escalations/page.tsx`

- [ ] **Step 1: Update cx-routing service — add location/reviewer data, ticket numbers, activity log**

In `apps/api/src/cx-routing/cx-routing.service.ts`, update the `listEscalations` method to join review and location data. Find the method that lists escalations and enhance its return data to include:
- `reviewerName` from the linked review
- `locationName` from the linked location
- `reviewRating` from the linked review
- `reviewText` (truncated) from the linked review
- `reviewedAt` from the linked review

Add a helper method for ticket number generation:
```typescript
  private async generateTicketNumber(workspaceId: string): Promise<number> {
    const result = await this.db
      .select({ maxTicket: sql<number>`COALESCE(MAX(${escalations.ticketNumber}), 0)` })
      .from(escalations)
      .where(eq(escalations.workspaceId, workspaceId))
    return (result[0]?.maxTicket ?? 0) + 1
  }
```

Update the escalation creation to set `ticketNumber`:
```typescript
// In the create escalation method, add:
ticketNumber: await this.generateTicketNumber(input.workspaceId),
activityLog: [{ text: 'Ticket created', authorId: userId, authorName: 'System', timestamp: new Date().toISOString() }],
```

Add an `addNote` method:
```typescript
  async addNote(
    input: { workspaceId: string; escalationId: string; text: string },
    userId: string,
    userName: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    const esc = await this.db.query.escalations.findFirst({
      where: and(
        eq(escalations.id, input.escalationId),
        eq(escalations.workspaceId, input.workspaceId),
      ),
    })

    if (!esc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Escalation not found' })
    }

    const currentLog = (esc.activityLog ?? []) as Array<{ text: string; authorId: string; authorName: string; timestamp: string }>
    const newEntry = { text: input.text, authorId: userId, authorName: userName, timestamp: new Date().toISOString() }

    const [updated] = await this.db
      .update(escalations)
      .set({
        activityLog: [...currentLog, newEntry],
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, input.escalationId))
      .returning()

    return updated
  }
```

- [ ] **Step 2: Overhaul escalations page UI**

In `apps/web/src/app/dashboard/escalations/page.tsx`, make these changes:

1. Remove all SLA-related UI: `SLACountdown` component, breach warnings, deadline displays, expired badges
2. Add ticket number display formatted as `#TKT-{ticketNumber.toString().padStart(3, '0')}`
3. Show reviewer name, location name, and capture date on each escalation card
4. Replace status options: show `Open`, `In Progress`, `Resolved`, `Closed` (hide `Expired`)
5. Add an activity log section in the detail sheet showing timestamped notes
6. Add a text input + "Add Note" button for appending notes

Key UI changes in the escalation card:
```tsx
{/* Ticket number */}
<span className="text-xs font-mono text-muted-foreground">
  #TKT-{String(esc.ticketNumber ?? 0).padStart(3, '0')}
</span>

{/* Reviewer name from linked review */}
{esc.reviewerName && (
  <span className="text-sm font-medium">{esc.reviewerName}</span>
)}

{/* Location */}
{esc.locationName && (
  <Badge variant="outline" className="text-xs">{esc.locationName}</Badge>
)}

{/* Date */}
<span className="text-xs text-muted-foreground">
  {esc.createdAt ? formatDistanceToNow(new Date(esc.createdAt), { addSuffix: true }) : ''}
</span>
```

Status filter options update:
```tsx
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]
```

Activity log in the detail sheet:
```tsx
{/* Activity Log */}
<div className="space-y-3 mt-4">
  <h4 className="text-sm font-medium">Activity Log</h4>
  {(selectedEscalation?.activityLog ?? []).map((entry: any, i: number) => (
    <div key={i} className="flex gap-2 text-sm">
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {format(new Date(entry.timestamp), 'MMM d, HH:mm')}
      </span>
      <span className="font-medium text-xs">{entry.authorName}:</span>
      <span className="text-xs">{entry.text}</span>
    </div>
  ))}
</div>
```

---

## Execution Summary

| Task | Description | Complexity |
|------|-------------|------------|
| 1 | InfoTooltip component | Small |
| 2 | DateRangePicker component | Medium |
| 3 | PlatformIcons component | Small |
| 4 | DB: Location ownerName | Small |
| 5 | DB: Escalation ticket fields | Small |
| 6 | Dashboard: Remove System Healthy | Trivial |
| 7 | Dashboard: Global Search | Large |
| 8 | Locations: Icons + Owner | Medium |
| 9 | Inbox: Location/Date/Search/Filter | Large |
| 10 | Analytics: Filters + Tooltips | Medium |
| 11 | Automations rename + sidebar | Trivial |
| 12 | Settings merge | Large |
| 13 | Customer bulk upload | Large |
| 14 | Escalations ticket system | Large |

**Total: 14 tasks across 9 chunks**

Tasks 1-5 should be done first (shared components + DB). Then 6-14 in order. Tasks with no dependencies between them can be parallelized via subagents (e.g., Task 6 + Task 11 in parallel).
