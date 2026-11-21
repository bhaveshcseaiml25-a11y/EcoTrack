'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Moon, Search, Settings, ShieldCheck, Sun, UserRound, Users } from 'lucide-react'
import * as api from '@/lib/api'
import { SEVERITY_META } from '@/lib/constants'
import { formatRelative } from '@/lib/logic'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/eco/primitives'

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return ref
}

function GlobalSearch() {
  const { db } = useStore()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const term = q.trim().toLowerCase()

  const bins = term
    ? (db?.bins ?? []).filter((b) => `${b.id} ${b.location} ${b.area}`.toLowerCase().includes(term)).slice(0, 5)
    : []
  const complaints = term
    ? (db?.complaints ?? []).filter((c) => `${c.id} ${c.address} ${c.category}`.toLowerCase().includes(term)).slice(0, 5)
    : []

  const go = (href: string) => {
    setOpen(false)
    setQ('')
    router.push(href)
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search bins, areas or complaint IDs…"
        aria-label="Search EcoTrack"
        className="h-9 w-full rounded-lg border border-input bg-muted/50 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      {open && term && (
        <div className="absolute top-11 left-0 z-50 w-full overflow-hidden rounded-xl border bg-popover shadow-xl animate-in fade-in slide-in-from-top-1">
          {bins.length === 0 && complaints.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results for “{q}”</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {bins.length > 0 && <p className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Smart bins</p>}
              {bins.map((b) => (
                <button key={b.id} type="button" onClick={() => go(`/bins?bin=${b.id}`)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted">
                  <span>
                    <span className="font-medium">{b.id}</span> <span className="text-muted-foreground">· {b.location}, {b.area}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{b.fillLevel}%</span>
                </button>
              ))}
              {complaints.length > 0 && <p className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Complaints</p>}
              {complaints.map((c) => (
                <button key={c.id} type="button" onClick={() => go(`/complaints?id=${c.id}`)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted">
                  <span>
                    <span className="font-medium">{c.id}</span> <span className="text-muted-foreground">· {c.category}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationMenu() {
  const { db, run } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const unread = db?.alerts.filter((a) => !a.isRead && !a.isResolved) ?? []
  const recent = (db?.alerts ?? []).filter((a) => !a.isResolved).slice(0, 6)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Notifications, ${unread.length} unread`}
        aria-expanded={open}
      >
        <Bell className="size-[18px]" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] font-bold text-white ring-2 ring-card">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-xl animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Municipal notifications</p>
              <p className="text-xs text-muted-foreground">{unread.length} unread · simulated in-app only</p>
            </div>
            <button
              type="button"
              disabled={!unread.length}
              onClick={() => run('read-all', () => api.markAlertsRead('all'))}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {recent.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
            {recent.map((a) => (
              <li key={a.id} className={cn('flex gap-3 border-b px-4 py-3 last:border-0', !a.isRead && 'bg-accent/40')}>
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: SEVERITY_META[a.severity].color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{a.binId}</p>
                    <Badge className={SEVERITY_META[a.severity].badge}>{SEVERITY_META[a.severity].label}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.location} · {a.fillLevel}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatRelative(a.timestamp)}</p>
                </div>
                {!a.isRead && (
                  <button type="button" onClick={() => run('read', () => api.markAlertsRead([a.id]))} className="self-start text-xs text-primary hover:underline">
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Link href="/alerts" onClick={() => setOpen(false)} className="block border-t px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted">
            View all alerts & history
          </Link>
        </div>
      )}
    </div>
  )
}

export function RoleSwitcher({ compact }: { compact?: boolean }) {
  const { role, setRole } = useStore()
  const router = useRouter()
  const choose = (r: 'admin' | 'citizen') => {
    setRole(r)
    router.push(r === 'admin' ? '/' : '/citizen')
  }
  return (
    <div role="radiogroup" aria-label="Demo role" className="flex items-center rounded-lg border bg-muted/50 p-0.5 text-xs font-medium">
      {(['admin', 'citizen'] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={role === r}
          onClick={() => choose(r)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors',
            role === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {r === 'admin' ? <ShieldCheck className="size-3.5" /> : <Users className="size-3.5" />}
          <span className={cn(compact && 'sr-only sm:not-sr-only')}>{r === 'admin' ? 'Administrator' : 'Citizen'}</span>
        </button>
      ))}
    </div>
  )
}

function ProfileMenu() {
  const { db, run, setRole } = useStore()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const name = db?.settings.adminName ?? 'Administrator'
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
  const dark = db?.settings.theme === 'dark'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{initials}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-medium">{name}</span>
          <span className="flex items-center gap-1 text-[11px] text-primary">
            <ShieldCheck className="size-3" aria-hidden="true" /> Administrator
          </span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-50 w-60 overflow-hidden rounded-xl border bg-popover py-1 shadow-xl animate-in fade-in slide-in-from-top-1">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{db?.settings.adminEmail}</p>
          </div>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted">
            <UserRound className="size-4 text-muted-foreground" /> Profile
          </Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted">
            <Settings className="size-4 text-muted-foreground" /> Settings
          </Link>
          <button
            type="button"
            onClick={() => run('theme', () => api.updateSettings({ theme: dark ? 'light' : 'dark' }))}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
          >
            {dark ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
            {dark ? 'Light theme' : 'Dark theme'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('citizen')
              router.push('/citizen')
            }}
            className="flex w-full items-center gap-2 border-t px-4 py-2 text-sm hover:bg-muted"
          >
            <LogOut className="size-4 text-muted-foreground" /> Switch to citizen view
          </button>
        </div>
      )}
    </div>
  )
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur-md md:px-6">
      <button type="button" onClick={onMenu} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <div className="flex flex-1 items-center gap-3">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1.5 md:gap-3">
        <div className="hidden sm:block">
          <RoleSwitcher compact />
        </div>
        <NotificationMenu />
        <ProfileMenu />
      </div>
    </header>
  )
}
