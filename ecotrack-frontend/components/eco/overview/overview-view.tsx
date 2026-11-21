'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertOctagon,
  ArrowRight,
  BellRing,
  Clock,
  MapPinned,
  MessageSquareWarning,
  PieChart as PieIcon,
  Recycle,
  Trash2,
  Truck,
  TrendingUp,
} from 'lucide-react'
import { useNow, useStore } from '@/lib/store'
import { CITY_NAME, SEVERITY_META, timeAgo } from '@/lib/domain'
import { HOURLY_ACTIVITY } from '@/lib/analytics-data'
import { cn } from '@/lib/utils'
import { Card, CardHeader, EmptyState, FillBar, PageHeader } from '../primitives'
import { StatCard } from '../stat-card'
import { CityMap } from '../city-map'
import { axisProps, FillDistributionChart, tooltipStyle } from '../charts'
import { ComplaintStatusBadge, VehicleStatusBadge } from '../badges'

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      View all <ArrowRight className="size-3" aria-hidden />
    </Link>
  )
}

export function OverviewView() {
  const { state } = useStore()
  const router = useRouter()
  const now = useNow()
  const { bins, alerts, vehicles, complaints, settings } = state

  const critical = bins.filter((b) => b.fillLevel >= 100).length
  const awaiting = bins.filter((b) => b.fillLevel >= settings.thresholds.collection).length
  const activeVehicles = vehicles.filter((v) => v.status === 'on-route').length
  const pendingComplaints = complaints.filter((c) => c.status !== 'Resolved').length
  const collectedKg = vehicles.reduce((s, v) => s + v.collectedTodayKg, 0)
  const activeAlerts = alerts.filter((a) => a.status !== 'resolved').slice(0, 5)
  const recentComplaints = complaints.slice(0, 4)
  const avgFill = Math.round(bins.reduce((s, b) => s + b.fillLevel, 0) / Math.max(1, bins.length))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Good day, ${settings.profile.name.split(' ')[0]}`}
        description={`Live status of ${CITY_NAME}'s waste collection network across ${new Set(bins.map((b) => b.area)).size} districts.`}
        actions={
          <>
            <Link
              href="/routes"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Truck className="size-4" aria-hidden /> Plan collection
            </Link>
            <Link
              href="/bins"
              className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Trash2 className="size-4" aria-hidden /> Monitor bins
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Smart Bins" value={bins.length} hint={`Avg. fill ${avgFill}%`} icon={Trash2} tone="navy" />
        <StatCard label="Bins at Critical Level" value={critical} hint="100% full" icon={AlertOctagon} tone="red" />
        <StatCard label="Awaiting Collection" value={awaiting} hint={`≥ ${settings.thresholds.collection}% fill`} icon={Clock} tone="orange" />
        <StatCard label="Vehicles Active" value={`${activeVehicles}/${vehicles.length}`} hint="On collection route" icon={Truck} tone="teal" />
        <StatCard label="Pending Complaints" value={pendingComplaints} hint={`${complaints.length} total`} icon={MessageSquareWarning} tone="orange" />
        <StatCard label="Collected Today" value={`${(collectedKg / 1000).toFixed(1)} t`} hint="Across all vehicles" icon={Recycle} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={MapPinned}
            title="City bin map"
            description="Live bin locations colored by fill level. Click a marker to open the bin."
            action={<ViewAll href="/bins" />}
          />
          <div className="p-5 pt-4">
            <CityMap
              className="h-[380px]"
              bins={bins}
              vehicles={vehicles}
              showDepot
              onBinClick={(b) => router.push(`/bins?bin=${b.id}`)}
            />
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={BellRing} title="Recent alerts" description="Bins above alert thresholds" action={<ViewAll href="/alerts" />} />
          <div className="flex-1 p-3">
            {activeAlerts.length === 0 ? (
              <EmptyState icon={BellRing} title="No active alerts" description="All bins are below the warning threshold." />
            ) : (
              <ul className="flex flex-col">
                {activeAlerts.map((a) => (
                  <li key={a.id}>
                    <Link href="/alerts" className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted">
                      <span className={cn('size-2 shrink-0 rounded-full', SEVERITY_META[a.severity].dot)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{a.binId}</span>
                          <span className="text-sm font-semibold tabular-nums">{a.fillLevel}%</span>
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">
                            {a.location}, {a.area}
                          </span>
                          <span className="shrink-0">{timeAgo(a.updatedAt, now)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={TrendingUp} title="Waste collection activity" description="Pickups per hour today" />
          <div className="h-64 p-5 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HOURLY_ACTIVITY} margin={{ left: -18, right: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="hour" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="collections" name="Collections" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader icon={PieIcon} title="Bin fill-level distribution" description="Updates live as sensors report" />
          <div className="p-5 pt-4">
            <FillDistributionChart bins={bins} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={MessageSquareWarning} title="Recent complaints" description="From the citizen portal" action={<ViewAll href="/complaints" />} />
          <ul className="flex flex-col p-3">
            {recentComplaints.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/complaints?id=${c.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.category}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.id} · {c.address}, {c.area} · {timeAgo(c.createdAt, now)}
                    </span>
                  </span>
                  <ComplaintStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={Truck} title="Vehicle activity" description="Fleet status and current load" action={<ViewAll href="/routes" />} />
          <ul className="flex flex-col gap-1 p-3">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Truck className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {v.name} <span className="text-muted-foreground">· {v.driver}</span>
                    </p>
                    <VehicleStatusBadge status={v.status} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <FillBar value={v.loadPct} color="bg-chart-2" className="h-1.5" />
                    <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                      {v.loadPct}% · {(v.collectedTodayKg / 1000).toFixed(1)} t
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
