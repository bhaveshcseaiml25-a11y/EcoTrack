'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Gauge, Loader2, Navigation, Play, Route as RouteIcon, Sparkles, Trash2, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/lib/store'
import { routeOptimizer } from '@/lib/route-optimizer'
import { BIN_STATUS_META, getBinStatus, timeAgo } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, EmptyState, FillBar, PageHeader, Pill, SimulatedTag } from '../primitives'
import { VehicleStatusBadge } from '../badges'
import { StatCard } from '../stat-card'
import { CityMap } from '../city-map'

export function RoutesView() {
  const { state, setRoutePlan, startRoute, collectNextStop } = useStore()
  const now = useNow()
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const { bins, vehicles, routePlan, settings } = state

  const pending = useMemo(
    () => bins.filter((b) => b.fillLevel >= settings.thresholds.collection).sort((a, b) => b.fillLevel - a.fillLevel),
    [bins, settings.thresholds.collection],
  )
  const binById = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins])
  const planBins = useMemo(() => {
    if (!routePlan) return pending
    const ids = new Set(routePlan.routes.flatMap((r) => r.stops))
    return bins.filter((b) => ids.has(b.id))
  }, [routePlan, pending, bins])

  async function optimize() {
    setLoading(true)
    try {
      const plan = await routeOptimizer.optimize({ bins: pending, vehicles })
      setRoutePlan(plan)
      setHighlight(null)
      toast.success('Routes optimized', {
        description: `${plan.routes.length} routes · ${plan.totalDistanceKm} km · ~${plan.timeSavedMin} min saved`,
      })
    } catch (e) {
      toast.error('Could not optimize routes', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  const completedStops = routePlan?.routes.reduce((s, r) => s + r.completedStops, 0) ?? 0
  const totalStops = routePlan?.routes.reduce((s, r) => s + r.stops.length, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Route Optimization"
        description={`Plan collection for every bin at or above ${settings.thresholds.collection}% using the nearest available vehicles.`}
        actions={
          <>
            {routePlan && (
              <Button variant="outline" onClick={() => setRoutePlan(null)} disabled={loading}>
                <X className="size-4" aria-hidden /> Clear plan
              </Button>
            )}
            <Button onClick={optimize} disabled={loading || pending.length === 0}>
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              {loading ? 'Optimizing…' : routePlan ? 'Re-optimize routes' : 'Optimize routes'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bins awaiting pickup" value={pending.length} hint={`≥ ${settings.thresholds.collection}% fill`} icon={Trash2} tone="orange" />
        <StatCard
          label="Planned distance"
          value={routePlan ? `${routePlan.totalDistanceKm} km` : '—'}
          hint={routePlan ? `vs ${routePlan.baselineDistanceKm} km unoptimized` : 'Run optimizer to plan'}
          icon={Navigation}
          tone="navy"
        />
        <StatCard label="Estimated time saved" value={routePlan ? `${routePlan.timeSavedMin} min` : '—'} hint="Compared to fixed schedules" icon={Clock} tone="green" />
        <StatCard
          label="Stops completed"
          value={routePlan ? `${completedStops}/${totalStops}` : '—'}
          hint={routePlan ? `Plan generated ${timeAgo(routePlan.generatedAt, now)}` : 'No active plan'}
          icon={Gauge}
          tone="teal"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={RouteIcon}
            title={routePlan ? 'Optimized collection routes' : 'Bins requiring collection'}
            description={routePlan ? 'Select a route to highlight it on the map' : 'Run the optimizer to assign these bins to vehicles'}
            action={<SimulatedTag />}
          />
          <div className="relative p-5 pt-4">
            <CityMap
              className="h-[460px]"
              bins={planBins}
              vehicles={vehicles}
              routes={routePlan?.routes}
              highlightRouteId={highlight}
              showDepot
            />
            {loading && (
              <div className="absolute inset-5 top-4 z-[600] flex flex-col items-center justify-center gap-3 rounded-lg bg-card/80 backdrop-blur-sm">
                <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium">Clustering bins and sequencing stops…</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={Truck} title="Fleet" description={`${vehicles.filter((v) => v.status !== 'maintenance').length} vehicles available for dispatch`} />
          <ul className="flex flex-col gap-1 p-3">
            {vehicles.map((v) => (
              <li key={v.id} className="rounded-lg px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {v.name} <span className="font-mono text-xs text-muted-foreground">{v.plate}</span>
                  </p>
                  <VehicleStatusBadge status={v.status} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <FillBar value={v.loadPct} color={v.loadPct > 85 ? 'bg-warning' : 'bg-chart-2'} className="h-1.5" />
                  <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">Load {v.loadPct}%</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {!routePlan ? (
        <Card>
          {pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No bins need collection" description="Every bin is below the collection threshold. Check back after the next sensor sweep." />
          ) : (
            <>
              <CardHeader title="Collection queue" description="Sorted by fill level" />
              <ul className="grid gap-2 p-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-semibold">{b.id}</span>
                      <span className="block truncate text-sm">
                        {b.location}, {b.area}
                      </span>
                    </span>
                    <span className={cn('text-sm font-semibold tabular-nums', BIN_STATUS_META[getBinStatus(b.fillLevel)].text)}>{b.fillLevel}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {routePlan.routes.map((r) => {
            const vehicle = vehicles.find((v) => v.id === r.vehicleId)
            const progress = Math.round((r.completedStops / Math.max(1, r.stops.length)) * 100)
            const isHighlighted = highlight === r.id
            return (
              <Card
                key={r.id}
                className={cn('flex flex-col transition-shadow', isHighlighted && 'ring-2')}
                style={isHighlighted ? ({ '--tw-ring-color': r.color } as React.CSSProperties) : undefined}
              >
                <button
                  type="button"
                  onClick={() => setHighlight(isHighlighted ? null : r.id)}
                  aria-pressed={isHighlighted}
                  className="flex items-start justify-between gap-3 rounded-t-xl px-5 pt-5 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="size-3 rounded-full" style={{ background: r.color }} aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold">
                        Route {r.id} · {vehicle?.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">Driver {vehicle?.driver}</span>
                    </span>
                  </span>
                  <Pill
                    className={cn(
                      r.status === 'completed' ? 'bg-success/12 text-success' : r.status === 'in-progress' ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {r.status === 'in-progress' ? 'In progress' : r.status === 'completed' ? 'Completed' : 'Pending'}
                  </Pill>
                </button>
                <dl className="grid grid-cols-3 gap-2 px-5 pt-4 text-center">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <dt className="text-[11px] text-muted-foreground">Stops</dt>
                    <dd className="text-sm font-semibold tabular-nums">{r.stops.length}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <dt className="text-[11px] text-muted-foreground">Distance</dt>
                    <dd className="text-sm font-semibold tabular-nums">{r.distanceKm} km</dd>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <dt className="text-[11px] text-muted-foreground">Est. time</dt>
                    <dd className="text-sm font-semibold tabular-nums">{r.durationMin} min</dd>
                  </div>
                </dl>
                <ol className="flex flex-1 flex-col gap-1.5 px-5 pt-4 text-sm">
                  {r.stops.map((id, i) => {
                    const b = binById.get(id)
                    const done = i < r.completedStops
                    const next = i === r.completedStops && r.status === 'in-progress'
                    return (
                      <li key={id} className={cn('flex items-center gap-2.5', done && 'text-muted-foreground line-through')}>
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                            done ? 'bg-success text-white' : next ? 'text-white' : 'bg-muted text-muted-foreground',
                          )}
                          style={next ? { background: r.color } : undefined}
                        >
                          {done ? <CheckCircle2 className="size-3" aria-hidden /> : i + 1}
                        </span>
                        <span className="truncate">
                          {id} · {b?.location}
                        </span>
                        {!done && b && <span className="ml-auto shrink-0 text-xs tabular-nums">{b.fillLevel}%</span>}
                      </li>
                    )
                  })}
                </ol>
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <FillBar value={progress} color="bg-primary" className="h-1.5" />
                    <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
                  </div>
                  {r.status === 'pending' && (
                    <Button
                      onClick={() => {
                        startRoute(r.id)
                        setHighlight(r.id)
                        toast.success(`Route ${r.id} dispatched`, { description: `${vehicle?.name} is heading to the first stop.` })
                      }}
                    >
                      <Play className="size-4" aria-hidden /> Dispatch vehicle
                    </Button>
                  )}
                  {r.status === 'in-progress' && (
                    <Button variant="outline" onClick={() => collectNextStop(r.id)}>
                      <CheckCircle2 className="size-4" aria-hidden /> Confirm next pickup
                    </Button>
                  )}
                  {r.status === 'completed' && <p className="text-center text-xs font-medium text-success">All stops collected · returned to depot</p>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
