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
import { OrgSwitcher } from '@/components/dashboard/org-switcher'

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

        {/* Phase 1 — organization switcher (hidden in single-org direct mode) */}
        <OrgSwitcher />

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
