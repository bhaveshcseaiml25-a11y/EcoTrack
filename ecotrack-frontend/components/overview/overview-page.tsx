'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  ClipboardList,
  Gauge,
  MessageSquareWarning,
  PieChart as PieIcon,
  Route,
  Scale,
  Trash2,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/eco/primitives'
import { UnifiedMap } from '@/components/eco/unified-map'
import { Button } from '@/components/ui/button'
import { buildAnalytics } from '@/lib/analytics'
import * as api from '@/lib/api'
import { COMPLAINT_STATUS_META, SEVERITY_META, VEHICLE_STATUS_META } from '@/lib/constants'
import { formatRelative } from '@/lib/logic'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  href: string
  label: string
  value: string | number
  icon: typeof Trash2
  hint: string
  tone: 'teal' | 'critical' | 'high' | 'info' | 'moderate' | 'normal'
}) {
  const tones = {
    teal: 'bg-accent text-accent-foreground',
    critical: 'bg-status-critical/12 text-status-critical',
    high: 'bg-status-high/12 text-status-high',
    info: 'bg-status-info/12 text-status-info',
    moderate: 'bg-status-moderate/15 text-status-moderate',
    normal: 'bg-status-normal/12 text-status-normal',
  }
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between">
        <span className={cn('flex size-9 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </Link>
  )
}

export function OverviewPage() {
  const { db, run, busy } = useStore()
  const analytics = useMemo(() => (db ? buildAnalytics(db, { days: 7, area: 'all' }) : null), [db])
  if (!db || !analytics) return null

  const t = db.settings.thresholds
  const critical = db.bins.filter((b) => b.fillLevel >= t.critical).length
  const awaiting = db.bins.filter((b) => b.fillLevel >= t.warning)
  const scheduled = new Set(db.routes.filter((r) => r.status !== 'completed').flatMap((r) => r.orderedStops.filter((s) => !s.collected).map((s) => s.binId)))
  const activeVehicles = db.vehicles.filter((v) => v.status !== 'maintenance').length
  const onRoute = db.vehicles.filter((v) => v.status === 'on-route').length
  const pending = db.complaints.filter((c) => c.status !== 'resolved').length
  const openAlerts = db.alerts.filter((a) => !a.isResolved)
  const totalStops = db.routes.reduce((s, r) => s + r.orderedStops.length, 0)
  const doneStops = db.routes.reduce((s, r) => s + r.orderedStops.filter((x) => x.collected).length, 0)
  const resolvedRate = Math.round((db.complaints.filter((c) => c.status === 'resolved').length / Math.max(1, db.complaints.length)) * 100)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="City operations overview"
        description="Live status of Greenhaven's smart waste network. All sensor readings are simulated for demonstration."
        actions={
          <>
            <Button variant="outline" disabled={busy === 'simulate'} onClick={() => run('simulate', api.simulateBinActivity, { tone: 'info', title: 'Bin activity simulated' })}>
              <Gauge /> Simulate bin activity
            </Button>
            <Button render={<Link href="/routes" />} nativeButton={false}>
              <Route /> Optimize routes
            </Button>
          </>
        }
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard href="/bins" label="Total smart bins" value={db.bins.length} icon={Trash2} hint={`${new Set(db.bins.map((b) => b.area)).size} areas connected`} tone="teal" />
        <StatCard href="/bins?status=full" label="Bins at critical level" value={critical} icon={AlertTriangle} hint={`At or above ${t.critical}%`} tone="critical" />
        <StatCard href="/routes" label="Awaiting collection" value={awaiting.length} icon={ClipboardList} hint={`${scheduled.size} scheduled on routes`} tone="high" />
        <StatCard href="/routes" label="Active vehicles" value={activeVehicles} icon={Truck} hint={`${onRoute} currently on route`} tone="info" />
        <StatCard href="/complaints" label="Pending complaints" value={pending} icon={MessageSquareWarning} hint={`${db.complaints.filter((c) => c.status === 'submitted').length} awaiting review`} tone="moderate" />
        <StatCard href="/analytics" label="Collected today" value={`${(db.collectedTodayKg / 1000).toFixed(1)} t`} icon={Scale} hint="Simulated weighbridge data" tone="normal" />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <UnifiedMap />
        </div>
        <Card className="flex flex-col">
          <CardHeader
            icon={BellRing}
            title="Recent municipal alerts"
            description={`${openAlerts.length} open alerts`}
            action={
              <Link href="/alerts" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          {openAlerts.length === 0 ? (
            <EmptyState title="No open alerts" description="Bins are below alert thresholds." />
          ) : (
            <ul className="flex-1 divide-y overflow-y-auto xl:max-h-[520px]">
              {openAlerts.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: SEVERITY_META[a.severity].color }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.binId} <span className="font-normal text-muted-foreground">· {a.location}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.fillLevel}% full · {formatRelative(a.timestamp)}
                    </p>
                  </div>
                  <Badge className={SEVERITY_META[a.severity].badge}>{SEVERITY_META[a.severity].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={TrendingUp} title="Waste collection activity" description="Last 7 days · kg collected vs generated (simulated)" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.daily} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="ov-col" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="generated" name="Generated (kg)" stroke="var(--chart-2)" fill="transparent" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="collected" name="Collected (kg)" stroke="var(--chart-1)" strokeWidth={2} fill="url(#ov-col)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader icon={PieIcon} title="Bin fill-level distribution" description="Current sensor readings" />
          <div className="flex items-center gap-4 p-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.fillDistribution} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="none">
                    {analytics.fillDistribution.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm">
              {analytics.fillDistribution.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: d.color }} aria-hidden="true" />
                    {d.name}
                  </span>
                  <span className="font-medium tabular-nums">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            icon={MessageSquareWarning}
            title="Recent citizen complaints"
            action={
              <Link href="/complaints" className="text-xs font-medium text-primary hover:underline">
                Manage
              </Link>
            }
          />
          <ul className="divide-y">
            {db.complaints.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/complaints?id=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.category}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.id} · {c.address}
                    </p>
                  </div>
                  <Badge className={COMPLAINT_STATUS_META[c.status].badge}>{COMPLAINT_STATUS_META[c.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={Truck} title="Vehicle activity" description={`${onRoute} of ${db.vehicles.length} on route`} />
          <ul className="divide-y">
            {db.vehicles.map((v) => {
              const route = db.routes.find((r) => r.id === v.assignedRoute)
              const done = route?.orderedStops.filter((s) => s.collected).length ?? 0
              return (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-navy text-white">
                    <Truck className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{v.vehicleName}</p>
                    <p className="text-xs text-muted-foreground">
                      {route ? `${done}/${route.orderedStops.length} stops · ${route.id}` : `Driver ${v.driver}`}
                    </p>
                  </div>
                  <Badge className={VEHICLE_STATUS_META[v.status].badge}>{VEHICLE_STATUS_META[v.status].label}</Badge>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={Gauge} title="Collection performance" description="Simulated operational KPIs" />
          <dl className="grid grid-cols-2 gap-px bg-border">
            {[
              { label: 'Route progress', value: totalStops ? `${Math.round((doneStops / totalStops) * 100)}%` : '—', sub: `${doneStops}/${totalStops} stops` },
              { label: 'Collection efficiency', value: `${analytics.summary.avgEfficiency}%`, sub: '7-day average' },
              { label: 'Complaint resolution', value: `${resolvedRate}%`, sub: `${db.complaints.length} total` },
              { label: 'Avg daily collection', value: `${(analytics.summary.avgDailyKg / 1000).toFixed(1)} t`, sub: 'Last 7 days' },
            ].map((s) => (
              <div key={s.label} className="bg-card p-4">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{s.value}</dd>
                <dd className="text-[11px] text-muted-foreground">{s.sub}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}
