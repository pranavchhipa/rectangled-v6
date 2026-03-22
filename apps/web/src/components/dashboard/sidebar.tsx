'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  MapPin,
  Users,
  Settings,
  LogOut,
  ChevronsUpDown,
  Plus,
  Inbox,
  BarChart3,
  Contact,
  Plug,
  FileText,
  Route,
  Building2,
  Ticket,
  AlertTriangle,
  Zap,
  Sparkles,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth-store'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Locations', href: '/dashboard/locations', icon: MapPin },
  { label: 'Inbox', href: '/dashboard/inbox', icon: Inbox },
  { label: 'Escalations', href: '/dashboard/escalations', icon: AlertTriangle },
  { label: 'Analytics & Reports', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'AI Studio', href: '/dashboard/rais', icon: Sparkles },
  { label: 'Journeys', href: '/dashboard/journeys', icon: Route },
  { label: 'Post-Review Actions', href: '/dashboard/automations', icon: Zap },
  { label: 'TruForms', href: '/dashboard/truforms', icon: FileText },
  { label: 'Coupons', href: '/dashboard/coupons', icon: Ticket },

  { label: 'Customers', href: '/dashboard/customers', icon: Contact },
  { label: 'Connectors', href: '/dashboard/connectors', icon: Plug },
  { label: 'Listings', href: '/dashboard/listings', icon: Building2 },
  { label: 'Team', href: '/dashboard/members', icon: Users },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, memberships, currentWorkspaceId, setCurrentWorkspace, logout } =
    useAuthStore()

  const currentWorkspace = memberships.find(
    (m) => m.workspaceId === currentWorkspaceId
  )

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? 'U'

  const workspaceInitial =
    currentWorkspace?.workspaceName?.[0]?.toUpperCase() ?? 'W'

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">R</span>
          </div>
          <span className="font-bold text-lg tracking-tight">rectangled</span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        {/* Workspace switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="w-full data-[state=open]:bg-sidebar-accent"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-primary font-semibold text-xs">
                  {workspaceInitial}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {currentWorkspace?.workspaceName ?? 'No workspace'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentWorkspace?.role ?? ''}
                </p>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width]"
          >
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.workspaceId}
                onClick={() => setCurrentWorkspace(m.workspaceId)}
                className={
                  m.workspaceId === currentWorkspaceId ? 'bg-accent' : ''
                }
              >
                <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center mr-2 shrink-0">
                  <span className="text-primary text-xs font-semibold">
                    {m.workspaceName[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="truncate">{m.workspaceName}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Plus className="w-4 h-4 mr-2" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SidebarSeparator />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="w-full">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width]"
          >
            <DropdownMenuItem
              onClick={() => router.push('/dashboard/settings')}
            >
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
      </SidebarFooter>
    </Sidebar>
  )
}
