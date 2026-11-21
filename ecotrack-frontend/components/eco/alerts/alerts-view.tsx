'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Activity, BellRing, CheckCheck, CheckCircle2, Eye, Mail, MessageSquare, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/lib/store'
import { formatDateTime, SEVERITY_META, timeAgo } from '@/lib/domain'
import type { Alert, AlertSeverity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Drawer, EmptyState, Field, FillBar, PageHeader, Pill, Segmented, Textarea } from '../primitives'
import { SeverityBadge } from '../badges'
import { StatCard } from '../stat-card'

type Tab = 'active' | 'unread' | 'resolved' | 'all'

function ResolveDrawer({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  const { resolveAlert } = useStore()
  const [note, setNote] = useState('')
  if (!alert) return null
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Resolve alert · ${alert.binId}`}
      description={`${alert.location}, ${alert.area}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              resolveAlert(alert.id, note.trim() || undefined)
              toast.success(`Alert for ${alert.binId} resolved`, { description: 'Bin fill level reset to 0%.' })
              onClose()
            }}
          >
            <CheckCircle2 className="size-4" aria-hidden /> Confirm resolution
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <SeverityBadge severity={alert.severity} />
            <span className="text-2xl font-semibold tabular-nums">{alert.fillLevel}%</span>
          </div>
          <FillBar value={alert.fillLevel} color={SEVERITY_META[alert.severity].dot} className="mt-3" />
          <p className="mt-3 text-xs text-muted-foreground">Raised {formatDateTime(alert.createdAt)}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Resolving confirms the bin was emptied on site. Its sensor reading will reset to 0% and the alert moves to the resolved log.
        </p>
        <Field label="Resolution note" htmlFor="resolution-note" hint="Optional. Visible in the activity log.">
          <Textarea
            id="resolution-note"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Emptied by Truck 03 during morning shift"
          />
        </Field>
      </div>
    </Drawer>
  )
}

export function AlertsView() {
  const { state, markAlertRead, markAllAlertsRead } = useStore()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('active')
  const [severity, setSeverity] = useState<'all' | AlertSeverity>('all')
  const [resolving, setResolving] = useState<Alert | null>(null)
  const { alerts, activity, settings } = state

  const list = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (tab === 'all' ||
            (tab === 'active' && a.status !== 'resolved') ||
            (tab === 'unread' && a.status === 'unread') ||
            (tab === 'resolved' && a.status === 'resolved')) &&
          (severity === 'all' || a.severity === severity),
      ),
    [alerts, tab, severity],
  )

  const active = alerts.filter((a) => a.status !== 'resolved')
  const bySeverity = (s: AlertSeverity) => active.filter((a) => a.severity === s).length
  const t = settings.thresholds

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts & Notifications"
        description="Alerts are generated automatically when a bin crosses a fill threshold and escalate as it fills further."
        actions={
          <Button variant="outline" onClick={markAllAlertsRead} disabled={!alerts.some((a) => a.status === 'unread')}>
            <CheckCheck className="size-4" aria-hidden /> Mark all as read
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active alerts" value={active.length} hint={`${alerts.filter((a) => a.status === 'unread').length} unread`} icon={BellRing} tone="navy" />
        <StatCard label="Warning" value={bySeverity('warning')} hint={`≥ ${t.warning}% fill`} icon={BellRing} tone="orange" />
        <StatCard label="High priority" value={bySeverity('high')} hint={`≥ ${t.high}% fill`} icon={BellRing} tone="orange" />
        <StatCard label="Critical" value={bySeverity('critical')} hint={`≥ ${t.critical}% fill`} icon={BellRing} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              label="Alert status"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'unread', label: 'Unread' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'all', label: 'All' },
              ]}
            />
            <Segmented
              label="Severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: 'all', label: 'All' },
                { value: 'warning', label: 'Warning' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing here" description="No alerts match the selected filters." />
          ) : (
            <ul className="divide-y">
              {list.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center animate-in fade-in',
                    a.status === 'unread' && 'bg-primary/[0.035]',
                  )}
                >
                  <span className={cn('hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex', SEVERITY_META[a.severity].bg, SEVERITY_META[a.severity].text)}>
                    <BellRing className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/bins?bin=${a.binId}`} className="font-mono text-sm font-semibold hover:text-primary">
                        {a.binId}
                      </Link>
                      <SeverityBadge severity={a.severity} />
                      {a.status === 'unread' && <Pill className="bg-primary/12 text-primary">New</Pill>}
                      {a.status === 'resolved' && <Pill className="bg-success/12 text-success">Resolved</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-sm">
                      {a.location}, {a.area} · <span className="font-semibold tabular-nums">{a.fillLevel}%</span> full
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.status === 'resolved' && a.resolvedAt
                        ? `Resolved ${timeAgo(a.resolvedAt, now)}${a.resolutionNote ? ` · ${a.resolutionNote}` : ''}`
                        : `Raised ${timeAgo(a.createdAt, now)} · updated ${timeAgo(a.updatedAt, now)}`}
                    </p>
                  </div>
                  {a.status !== 'resolved' && (
                    <div className="flex shrink-0 gap-2">
                      {a.status === 'unread' && (
                        <Button variant="ghost" size="sm" onClick={() => markAlertRead(a.id)}>
                          <Eye className="size-3.5" aria-hidden /> Mark read
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setResolving(a)}>
                        Resolve
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader icon={MessageSquare} title="Notification channels" description="Where alerts are delivered" />
            <ul className="flex flex-col gap-2 p-5 pt-4 text-sm">
              <li className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2">
                  <BellRing className="size-4 text-primary" aria-hidden /> In-app & toast
                </span>
                <Pill className={settings.notifications.inApp ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground'}>
                  {settings.notifications.inApp ? 'Active' : 'Off'}
                </Pill>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-dashed p-3 text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Smartphone className="size-4" aria-hidden /> SMS
                </span>
                <Pill className="bg-muted">Not connected</Pill>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-dashed p-3 text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Mail className="size-4" aria-hidden /> Email
                </span>
                <Pill className="bg-muted">Not connected</Pill>
              </li>
              <li className="pt-1 text-xs text-muted-foreground">
                SMS and email delivery require a messaging provider. Manage preferences in{' '}
                <Link href="/settings" className="font-medium text-primary hover:underline">
                  Settings
                </Link>
                .
              </li>
            </ul>
          </Card>

          <Card className="flex-1">
            <CardHeader icon={Activity} title="Activity log" description="Automated system events" />
            {activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" />
            ) : (
              <ol className="relative flex max-h-[460px] flex-col gap-4 overflow-y-auto p-5 pt-4">
                {activity.slice(0, 40).map((e) => (
                  <li key={e.id} className="relative flex gap-3 pl-1">
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        e.type.includes('resolved') || e.type === 'bin-reset'
                          ? 'bg-success'
                          : e.type.startsWith('alert')
                            ? 'bg-warning'
                            : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.message}</p>
                      <p className="text-[11px] text-muted-foreground">{timeAgo(e.createdAt, now)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <ResolveDrawer key={resolving?.id} alert={resolving} onClose={() => setResolving(null)} />
    </div>
  )
}
