'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  MessageSquareWarning,
  Route,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import { Logo } from '@/components/eco/logo'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/bins', label: 'Smart Bin Monitoring', icon: Trash2 },
  { href: '/alerts', label: 'Alerts & Notifications', icon: Bell, badge: 'alerts' as const },
  { href: '/routes', label: 'Route Optimization', icon: Route },
  { href: '/complaints', label: 'Citizen Complaints', icon: MessageSquareWarning, badge: 'complaints' as const },
  { href: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const pathname = usePathname()
  const { db } = useStore()
  const counts = {
    alerts: db?.alerts.filter((a) => !a.isRead && !a.isResolved).length ?? 0,
    complaints: db?.complaints.filter((c) => c.status === 'submitted').length ?? 0,
  }

  return (
    <>
      <div
        className={cn('fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm transition-opacity lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          collapsed ? 'lg:w-[76px]' : 'lg:w-64',
          mobileOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Logo collapsed={collapsed && !mobileOpen} />
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className={cn('mb-2 px-3 text-[10px] font-semibold tracking-widest text-sidebar-foreground/50 uppercase', collapsed && 'lg:sr-only')}>
            Operations
          </p>
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const count = item.badge ? counts[item.badge] : 0
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      collapsed && 'lg:justify-center lg:px-0',
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sidebar-primary" aria-hidden="true" />}
                    <item.icon className={cn('size-[18px] shrink-0', active && 'text-sidebar-primary')} aria-hidden="true" />
                    <span className={cn('flex-1 truncate', collapsed && 'lg:sr-only')}>{item.label}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          'flex h-5 min-w-5 items-center justify-center rounded-full bg-status-critical px-1.5 text-[10px] font-bold text-white',
                          collapsed && 'lg:absolute lg:top-1 lg:right-2 lg:h-4 lg:min-w-4 lg:px-1',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className={cn('mb-3 rounded-lg bg-sidebar-accent/60 p-3 text-xs', collapsed && 'lg:hidden')}>
            <p className="font-medium text-sidebar-accent-foreground">Greenhaven Municipal Corp.</p>
            <p className="mt-0.5 text-sidebar-foreground/60">IoT network · simulated data</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="hidden w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  )
}
