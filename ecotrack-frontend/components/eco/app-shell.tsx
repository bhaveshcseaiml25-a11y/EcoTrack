'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronsLeft, Users, X } from 'lucide-react'
import { NAV_ITEMS } from './nav'
import { useStore } from '@/lib/store'
import { CITY_NAME } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { Topbar } from './topbar'
import { Skeleton } from './primitives'


function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { state } = useStore()
  const unread = state.alerts.filter((a) => a.status === 'unread').length
  const pendingComplaints = state.complaints.filter((c) => c.status !== 'Resolved').length

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        const count = item.href === '/alerts' ? unread : item.href === '/complaints' ? pendingComplaints : 0
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" aria-hidden />}
            <item.icon className={cn('size-4 shrink-0', active && 'text-sidebar-primary')} aria-hidden />
            <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  'ml-auto rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                  item.href === '/alerts' ? 'bg-critical text-white' : 'bg-sidebar-primary text-sidebar-primary-foreground',
                  collapsed && 'absolute top-0.5 right-1.5 ml-0',
                )}
              >
                {count}
                <span className="sr-only">{item.href === '/alerts' ? ' unread alerts' : ' open complaints'}</span>
              </span>
            )}
          </Link>
        )
      })}

      <div className={cn('mt-4 border-t border-sidebar-border pt-4', collapsed && 'pt-3')}>
        <p className={cn('px-3 pb-2 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase', collapsed && 'sr-only')}>
          Public
        </p>
        <Link
          href="/citizen"
          onClick={onNavigate}
          title={collapsed ? 'Citizen Portal' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          <Users className="size-4 shrink-0" aria-hidden />
          <span className={cn(collapsed && 'sr-only')}>Citizen Portal</span>
        </Link>
      </div>
    </nav>
  )
}

function ShellSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, storageError } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
          <Logo compact={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="p-3">
          {!collapsed && (
            <div className="mb-3 rounded-lg bg-sidebar-accent/60 p-3 text-xs">
              <p className="font-semibold text-sidebar-accent-foreground">{CITY_NAME} Municipal Corp.</p>
              <p className="mt-0.5 text-sidebar-foreground/60">Sensor network online · demo mode</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ChevronsLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} aria-hidden />
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-xl animate-in slide-in-from-left duration-200"
            aria-label="Mobile navigation"
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 hover:bg-sidebar-accent"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 md:px-6 lg:px-8">
          {storageError && (
            <p role="status" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
              {storageError}
            </p>
          )}
          {hydrated ? children : <ShellSkeleton />}
        </main>
      </div>
    </div>
  )
}
