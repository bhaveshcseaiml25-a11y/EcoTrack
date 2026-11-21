'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Fuel, Navigation, Route as RouteIcon, Timer, Trash, Truck } from 'lucide-react'
import { CityMap } from '@/components/map'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/eco/primitives'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { ROUTE_COLORS, ROUTE_STATUS_META, VEHICLE_STATUS_META } from '@/lib/constants'
import { formatMinutes } from '@/lib/logic'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function RoutesPage() {
  const { db, run, busy } = useStore()
  const [highlight, setHighlight] = useState<string | null>(null)
  if (!db) return null

  const t = db.settings.thresholds
  const pendingBins = db.bins.filter((b) => b.fillLevel >= t.warning)
  const distance = db.routes.reduce((s, r) => s + r.estimatedDistance, 0)
  const baseline = db.routes.reduce((s, r) => s + r.baselineDistance, 0)
  const time = db.routes.reduce((s, r) => s + r.estimatedTime, 0)
  const baseTime = db.routes.reduce((s, r) => s + r.baselineTime, 0)
  const saved = Math.max(0, baseline - distance)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Route optimization"
        description={`Generates collection routes for bins at or above ${t.warning}% using a simulated nearest-neighbour + 2-opt optimizer. Distances are straight-line estimates.`}
        actions={
          <>
            {db.routes.length > 0 && (
              <Button variant="outline" onClick={() => run('clear-routes', api.clearRoutes, { tone: 'info', title: 'Routes cleared' })}>
                <Trash /> Clear routes
              </Button>
            )}
            <Button
              disabled={busy === 'routes' || pendingBins.length === 0}
              onClick={() =>
                run('routes', api.generateCollectionRoutes, {
                  tone: 'success',
                  title: 'Optimized routes generated',
                  description: `${pendingBins.length} bins assigned across the active fleet.`,
                })
              }
            >
              <Navigation /> Generate optimized routes
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Bins needing collection', value: pendingBins.length, icon: Trash },
          { label: 'Total route distance', value: `${distance.toFixed(1)} km`, icon: RouteIcon, sub: baseline ? `vs ${baseline.toFixed(1)} km unoptimized` : undefined },
          { label: 'Estimated drive time', value: formatMinutes(time), icon: Timer, sub: baseTime ? `saves ${formatMinutes(Math.max(0, baseTime - time))}` : undefined },
          { label: 'Est. fuel saved', value: `${(saved * 0.38).toFixed(1)} L`, icon: Fuel, sub: `${saved.toFixed(1)} km shorter` },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <s.icon className="size-4 text-primary" aria-hidden="true" />
            <p className="mt-2 text-xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            {s.sub && <p className="text-[11px] text-status-normal">{s.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <CardHeader icon={RouteIcon} title="Route map" description="Numbered labels show stop order. Hover a route for details." />
          <div className="h-[560px]">
            <CityMap
              className="h-full w-full"
              bins={db.bins.filter((b) => b.fillLevel >= t.warning || db.routes.some((r) => r.binIds.includes(b.id)))}
              vehicles={db.vehicles}
              routes={db.routes}
              layers={{ complaints: false }}
              highlightRouteId={highlight}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {db.routes.length === 0 ? (
            <Card>
              <EmptyState
                icon={Navigation}
                title="No routes generated"
                description={pendingBins.length ? `${pendingBins.length} bins are waiting. Generate routes to dispatch the fleet.` : 'No bins currently need collection.'}
              />
            </Card>
          ) : (
            db.routes.map((r, i) => {
              const v = db.vehicles.find((x) => x.id === r.vehicleId)
              const done = r.orderedStops.filter((s) => s.collected).length
              const color = ROUTE_COLORS[i % ROUTE_COLORS.length]
              return (
                <Card
                  key={r.id}
                  className={cn('overflow-hidden transition-shadow', highlight === r.id && 'ring-2 ring-primary')}
                  onMouseEnter={() => setHighlight(r.id)}
                  onMouseLeave={() => setHighlight(null)}
                >
                  <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderLeft: `4px solid ${color}` }}>
                    <Truck className="size-4 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{v?.vehicleName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.id} · {v?.driver}
                      </p>
                    </div>
                    <Badge className={ROUTE_STATUS_META[r.status].badge}>{ROUTE_STATUS_META[r.status].label}</Badge>
                  </div>
                  <div className="grid grid-cols-3 border-b text-center text-xs">
                    <div className="p-2">
                      <p className="font-semibold tabular-nums">
                        {done}/{r.orderedStops.length}
                      </p>
                      <p className="text-muted-foreground">stops</p>
                    </div>
                    <div className="border-x p-2">
                      <p className="font-semibold tabular-nums">{r.estimatedDistance} km</p>
                      <p className="text-muted-foreground">distance</p>
                    </div>
                    <div className="p-2">
                      <p className="font-semibold tabular-nums">{formatMinutes(r.estimatedTime)}</p>
                      <p className="text-muted-foreground">est. time</p>
                    </div>
                  </div>
                  <ol className="max-h-48 overflow-y-auto px-4 py-2">
                    {r.orderedStops.map((s, idx) => (
                      <li key={s.binId} className="flex items-center gap-2 py-1 text-xs">
                        {s.collected ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-status-normal" aria-label="Collected" />
                        ) : (
                          <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pending" />
                        )}
                        <span className="w-5 text-muted-foreground tabular-nums">{idx + 1}.</span>
                        <span className={cn('font-medium', s.collected && 'text-muted-foreground line-through')}>{s.binId}</span>
                        <span className="truncate text-muted-foreground">{s.location}</span>
                      </li>
                    ))}
                  </ol>
                  {r.status !== 'completed' && (
                    <div className="border-t p-3">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={busy === r.id}
                        onClick={() => run(r.id, () => api.advanceRoute(r.id), { tone: 'success', title: `${v?.vehicleName} collected next stop` })}
                      >
                        <CheckCircle2 /> Complete next stop
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })
          )}

          <Card>
            <CardHeader icon={Truck} title="Fleet" />
            <ul className="divide-y">
              {db.vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>
                    {v.vehicleName} <span className="text-xs text-muted-foreground">· {v.capacityKg} kg</span>
                  </span>
                  <Badge className={VEHICLE_STATUS_META[v.status].badge}>{VEHICLE_STATUS_META[v.status].label}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
