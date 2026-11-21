'use client'

import { useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/eco/primitives'
import { useStore } from '@/lib/store'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function DataGate({ children }: { children: React.ReactNode }) {
  const { db, loading, error, reload } = useStore()
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <AlertCircle className="size-8 text-status-critical" aria-hidden="true" />
        <p className="font-medium">Could not load EcoTrack data</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={reload} variant="outline">
          <RefreshCw /> Retry
        </Button>
      </div>
    )
  }
  if (loading || !db) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }
  return <>{children}</>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 md:px-6 lg:py-8">
          <DataGate>{children}</DataGate>
        </main>
      </div>
    </div>
  )
}
