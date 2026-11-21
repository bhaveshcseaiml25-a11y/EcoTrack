'use client'

import { useState } from 'react'
import { BellRing, CheckCheck, CheckCircle2, History } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader, Select } from '@/components/eco/primitives'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { SEVERITY_META } from '@/lib/constants'
import { formatDateTime, formatRelative } from '@/lib/logic'
import { useStore } from '@/lib/store'
import type { AlertSeverity } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AlertsPage() {
  const { db, run, busy } = useStore()
  const [tab, setTab] = useState<'open' | 'history'>('open')
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all')
  if (!db) return null

  const t = db.settings.thresholds
  const list = db.alerts.filter((a) => (tab === 'open' ? !a.isResolved : a.isResolved) && (severity === 'all' || a.severity === severity))
  const unread = db.alerts.filter((a) => !a.isRead && !a.isResolved).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts & notifications"
        description={`Alerts are raised automatically when a bin crosses ${t.warning}% (warning), ${t.high}% (high) or ${t.critical}% (critical). Notifications are simulated in-app only.`}
        actions={
          <Button variant="outline" disabled={!unread || busy === 'read-all'} onClick={() => run('read-all', () => api.markAlertsRead('all'), { tone: 'success', title: 'All alerts marked as read' })}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(SEVERITY_META) as AlertSeverity[]).map((s) => {
          const count = db.alerts.filter((a) => a.severity === s && !a.isResolved).length
          return (
            <button
              key={s}
              type="button"
              aria-pressed={severity === s}
              onClick={() => setSeverity(severity === s ? 'all' : s)}
              className={cn('flex items-center justify-between rounded-xl border bg-card p-4 text-left shadow-sm hover:shadow-md', severity === s && 'ring-2 ring-primary')}
            >
              <div>
                <p className="text-xs text-muted-foreground">{SEVERITY_META[s].label} alerts open</p>
                <p className="text-2xl font-semibold tabular-nums">{count}</p>
              </div>
              <span className="size-3 rounded-full" style={{ background: SEVERITY_META[s].color }} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader
          icon={tab === 'open' ? BellRing : History}
          title={tab === 'open' ? 'Open alerts' : 'Alert history'}
          description={`${list.length} alerts`}
          action={
            <div className="flex items-center gap-2">
              <div role="tablist" className="flex rounded-lg border bg-muted/50 p-0.5 text-xs font-medium">
                {(['open', 'history'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    type="button"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={cn('rounded-md px-3 py-1.5 capitalize', tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}
                  >
                    {k === 'open' ? 'Open' : 'Resolved history'}
                  </button>
                ))}
              </div>
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity | 'all')} className="w-36" aria-label="Filter by severity">
                <option value="all">All severities</option>
                {(Object.keys(SEVERITY_META) as AlertSeverity[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_META[s].label}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={tab === 'open' ? 'No open alerts' : 'No resolved alerts yet'} description="Simulate bin activity to generate new alerts." />
        ) : (
          <ul className="divide-y">
            {list.map((a) => (
              <li key={a.id} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', !a.isRead && !a.isResolved && 'bg-accent/30')}>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_META[a.severity].color }} aria-hidden="true" />
                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.binId}</p>
                    <Badge className={SEVERITY_META[a.severity].badge}>{SEVERITY_META[a.severity].label}</Badge>
                    {!a.isRead && !a.isResolved && <Badge className="bg-primary/15 text-primary">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.location} reached {a.fillLevel}% capacity
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(a.timestamp)} · {formatRelative(a.timestamp)}
                    {a.resolvedAt && ` · resolved ${formatRelative(a.resolvedAt)}`}
                  </p>
                </div>
                {!a.isResolved && (
                  <div className="flex gap-2">
                    {!a.isRead && (
                      <Button size="sm" variant="ghost" onClick={() => run(`a-${a.id}`, () => api.markAlertsRead([a.id]))}>
                        Mark read
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy === `a-${a.id}`} onClick={() => run(`a-${a.id}`, () => api.resolveAlert(a.id), { tone: 'success', title: `Alert for ${a.binId} resolved` })}>
                      <CheckCircle2 /> Resolve
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
