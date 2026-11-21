'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Radio, RotateCcw, Settings, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/lib/store'
import { SEVERITY_META, timeAgo } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav'

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

function PopoverPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl animate-in fade-in slide-in-from-top-1 duration-150',
        className,
      )}
    >
      {children}
    </div>
  )
}

function NotificationsMenu() {
  const { state, markAlertRead, markAllAlertsRead, hydrated } = useStore()
  const { open, setOpen, ref } = usePopover()
  const router = useRouter()
  const now = useNow()
  const unread = hydrated ? state.alerts.filter((a) => a.status === 'unread') : []
  const recent = state.alerts.filter((a) => a.status !== 'resolved').slice(0, 6)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications, ${unread.length} unread`}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white tabular-nums ring-2 ring-card animate-in zoom-in">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <PopoverPanel className="w-[min(92vw,360px)]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">In-app municipal alerts</p>
            </div>
            <button
              type="button"
              onClick={markAllAlertsRead}
              disabled={!unread.length}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {recent.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No active alerts. All bins are within limits.</li>}
            {recent.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    markAlertRead(a.id)
                    setOpen(false)
                    router.push('/alerts')
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
                    a.status === 'unread' && 'bg-primary/[0.04]',
                  )}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_META[a.severity].dot)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {SEVERITY_META[a.severity].label} · {a.binId}
                      </span>
                      {a.status === 'unread' && <span className="sr-only">Unread</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.location}, {a.area} · {a.fillLevel}%
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{timeAgo(a.updatedAt, now)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted"
          >
            View all alerts
          </Link>
        </PopoverPanel>
      )}
    </div>
  )
}

function ProfileMenu() {
  const { state, resetDemo } = useStore()
  const { open, setOpen, ref } = usePopover()
  const { name, role, email } = state.settings.profile
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-sidebar text-xs font-semibold text-white">{initials}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-medium">{name}</span>
          <span className="block text-[11px] text-muted-foreground">Administrator</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden />
      </button>
      {open && (
        <PopoverPanel className="w-64">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">{role}</p>
          </div>
          <div role="menu" className="p-1.5">
            <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted">
              <Settings className="size-4 text-muted-foreground" aria-hidden /> Account settings
            </Link>
            <Link role="menuitem" href="/citizen" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted">
              <Users className="size-4 text-muted-foreground" aria-hidden /> Switch to citizen view
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                resetDemo()
                setOpen(false)
                toast.success('Demo data reset', { description: 'All bins, alerts and complaints restored to sample data.' })
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
            >
              <RotateCcw className="size-4 text-muted-foreground" aria-hidden /> Reset demo data
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false)
                toast.info('Sign-out is disabled in demo mode.')
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </div>
        </PopoverPanel>
      )}
    </div>
  )
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()
  const { state, updateSettings, hydrated } = useStore()
  const current = NAV_ITEMS.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))
  const live = hydrated && state.settings.system.autoSimulate

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur md:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{current?.label ?? 'EcoTrack'}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">Admin console</p>
      </div>

      <button
        type="button"
        onClick={() =>
          updateSettings({ ...state.settings, system: { ...state.settings.system, autoSimulate: !state.settings.system.autoSimulate } })
        }
        aria-pressed={live}
        className={cn(
          'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:inline-flex',
          live ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <span className="relative flex size-2">
          {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />}
          <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-primary' : 'bg-muted-foreground/50')} />
        </span>
        <Radio className="size-3.5" aria-hidden />
        {live ? 'Live simulation on' : 'Live simulation off'}
      </button>

      <div className="hidden items-center rounded-lg bg-muted p-0.5 text-xs font-medium md:flex" role="group" aria-label="Switch role">
        <span className="rounded-md bg-card px-2.5 py-1 shadow-sm" aria-current="true">
          Admin
        </span>
        <Link href="/citizen" className="rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground">
          Citizen
        </Link>
      </div>

      <NotificationsMenu />
      <ProfileMenu />
    </header>
  )
}
