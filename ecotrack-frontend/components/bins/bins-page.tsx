'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Activity, ArrowUp, Eraser, Filter, MapPin, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { CityMap } from '@/components/map'
import { Badge, Card, CardHeader, EmptyState, FillBar, Input, PageHeader, Select } from '@/components/eco/primitives'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { AREAS, BIN_STATUS_META } from '@/lib/constants'
import { formatDateTime, formatRelative } from '@/lib/logic'
import { useStore } from '@/lib/store'
import type { BinStatus, SmartBin } from '@/lib/types'
import { cn } from '@/lib/utils'

const FILL_RANGES = {
  all: 'Any fill level',
  '0-49': '0–49%',
  '50-79': '50–79%',
  '80-99': '80–99%',
  '100': '100%',
} as const

function inRange(level: number, range: keyof typeof FILL_RANGES) {
  if (range === 'all') return true
  if (range === '100') return level >= 100
  const [lo, hi] = range.split('-').map(Number)
  return level >= lo && level <= hi
}

function BinDetail({ bin, onClose }: { bin: SmartBin; onClose: () => void }) {
  const { run, busy, db } = useStore()
  const [manual, setManual] = useState(bin.fillLevel)
  const [prevId, setPrevId] = useState(bin.id)
  const [prevLevel, setPrevLevel] = useState(bin.fillLevel)
  if (prevId !== bin.id || prevLevel !== bin.fillLevel) {
    setPrevId(bin.id)
    setPrevLevel(bin.fillLevel)
    setManual(bin.fillLevel)
  }
  const meta = BIN_STATUS_META[bin.status]
  const alerts = db?.alerts.filter((a) => a.binId === bin.id).slice(0, 4) ?? []
  const set = (level: number, title: string) =>
    run(`bin-${bin.id}`, () => api.updateBinFillLevels([{ id: bin.id, fillLevel: level }]), { tone: 'success', title })

  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-right-2">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Smart bin</p>
          <h2 className="text-lg font-semibold">{bin.id}</h2>
          <p className="text-sm text-muted-foreground">
            {bin.location}, {bin.area}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close bin details">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-5 p-5">
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-3xl font-semibold tabular-nums" style={{ color: meta.color }}>
              {bin.fillLevel}%
            </span>
            <Badge className={meta.badge}>{meta.label}</Badge>
          </div>
          <FillBar value={bin.fillLevel} barClass={meta.bar} className="h-3" />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Waste category</dt>
            <dd className="font-medium">{bin.wasteCategory}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last updated</dt>
            <dd className="font-medium">{formatDateTime(bin.lastUpdated)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Coordinates</dt>
            <dd className="font-mono text-xs">
              {bin.latitude.toFixed(6)}, {bin.longitude.toFixed(6)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium">Simulation controls</p>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 25].map((n) => (
              <Button key={n} variant="outline" size="sm" disabled={busy === `bin-${bin.id}` || bin.fillLevel >= 100} onClick={() => set(bin.fillLevel + n, `${bin.id} fill increased by ${n}%`)}>
                <ArrowUp /> +{n}%
              </Button>
            ))}
          </div>
          <label htmlFor="manual-fill" className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            Manual fill-level adjustment <span className="font-medium text-foreground tabular-nums">{manual}%</span>
          </label>
          <input
            id="manual-fill"
            type="range"
            min={0}
            max={100}
            value={manual}
            onChange={(e) => setManual(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={manual === bin.fillLevel || busy === `bin-${bin.id}`} onClick={() => set(manual, `${bin.id} set to ${manual}%`)}>
              Apply level
            </Button>
            <Button size="sm" variant="outline" disabled={bin.fillLevel === 0} onClick={() => set(0, `${bin.id} marked as emptied`)}>
              <Eraser /> Empty bin
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium">Alert history</p>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No alerts raised for this bin.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-xs">
                  <span className="capitalize">
                    {a.severity} at {a.fillLevel}%
                  </span>
                  <span className="text-muted-foreground">
                    {a.isResolved ? 'Resolved' : 'Open'} · {formatRelative(a.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

export function BinsPage() {
  const { db, run, busy } = useStore()
  const params = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(params.get('bin'))
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('all')
  const [range, setRange] = useState<keyof typeof FILL_RANGES>('all')
  const [status, setStatus] = useState<BinStatus | 'all'>((params.get('status') as BinStatus) ?? 'all')
  const [category, setCategory] = useState('all')
  const [confirmReset, setConfirmReset] = useState(false)

  if (!db) return null
  const term = query.trim().toLowerCase()
  const bins = db.bins.filter(
    (b) =>
      (!term || `${b.id} ${b.location} ${b.area}`.toLowerCase().includes(term)) &&
      (area === 'all' || b.area === area) &&
      (status === 'all' || b.status === status) &&
      (category === 'all' || b.wasteCategory === category) &&
      inRange(b.fillLevel, range),
  )
  const selected = db.bins.find((b) => b.id === selectedId) ?? null
  const filtersActive = term || area !== 'all' || status !== 'all' || category !== 'all' || range !== 'all'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Smart bin monitoring"
        description="Simulated IoT sensors report fill levels in real time. Changes here update alerts, routes and dashboards instantly."
        actions={
          <>
            {confirmReset ? (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1 text-xs">
                Reset all demo data?
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() => {
                    setConfirmReset(false)
                    setSelectedId(null)
                    run('reset', api.resetSimulation, { tone: 'info', title: 'Simulation reset to initial data' })
                  }}
                >
                  Reset
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmReset(true)}>
                <RotateCcw /> Reset simulation
              </Button>
            )}
            <Button disabled={busy === 'simulate'} onClick={() => run('simulate', api.simulateBinActivity, { tone: 'info', title: 'Bin activity simulated', description: 'Random bins received new sensor readings.' })}>
              <Activity className={cn(busy === 'simulate' && 'animate-pulse')} /> Simulate bin activity
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(BIN_STATUS_META) as BinStatus[]).map((s) => {
          const count = db.bins.filter((b) => b.status === s).length
          const m = BIN_STATUS_META[s]
          return (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(status === s ? 'all' : s)}
              className={cn('flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md', status === s && 'ring-2 ring-primary')}
            >
              <span className="size-3 rounded-full" style={{ background: m.color }} aria-hidden="true" />
              <div>
                <p className="text-xl font-semibold tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader icon={Filter} title="Bins" description={`${bins.length} of ${db.bins.length} bins shown`} />
            <div className="grid gap-2 border-b px-5 py-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID or street" className="pl-8" aria-label="Search bins" />
              </div>
              <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area">
                <option value="all">All areas</option>
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
              <Select value={range} onChange={(e) => setRange(e.target.value as keyof typeof FILL_RANGES)} aria-label="Filter by fill level">
                {Object.entries(FILL_RANGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Select value={status} onChange={(e) => setStatus(e.target.value as BinStatus | 'all')} aria-label="Filter by status">
                <option value="all">All statuses</option>
                {(Object.keys(BIN_STATUS_META) as BinStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {BIN_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by waste category">
                <option value="all">All categories</option>
                {db.settings.wasteCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            {bins.length === 0 ? (
              <EmptyState
                icon={Trash2}
                title="No bins match these filters"
                action={
                  filtersActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuery('')
                        setArea('all')
                        setStatus('all')
                        setCategory('all')
                        setRange('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Bin ID</th>
                      <th className="px-3 py-2.5 font-medium">Location</th>
                      <th className="px-3 py-2.5 font-medium">Category</th>
                      <th className="w-48 px-3 py-2.5 font-medium">Fill level</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Updated</th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bins.map((b) => {
                      const m = BIN_STATUS_META[b.status]
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedId(b.id)}
                          className={cn('cursor-pointer transition-colors hover:bg-muted/50', selectedId === b.id && 'bg-accent/60')}
                        >
                          <td className="px-5 py-3 font-medium">
                            <button type="button" className="hover:underline" onClick={() => setSelectedId(b.id)}>
                              {b.id}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <p>{b.location}</p>
                            <p className="text-xs text-muted-foreground">{b.area}</p>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{b.wasteCategory}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <FillBar value={b.fillLevel} barClass={m.bar} />
                              <span className="w-9 text-right text-xs font-medium tabular-nums">{b.fillLevel}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={m.badge}>{m.label}</Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{formatRelative(b.lastUpdated)}</td>
                          <td className="px-5 py-3 text-right">
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={b.fillLevel >= 100 || busy === `bin-${b.id}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                run(`bin-${b.id}`, () => api.updateBinFillLevels([{ id: b.id, fillLevel: b.fillLevel + 10 }]))
                              }}
                              aria-label={`Increase ${b.id} fill level by 10%`}
                            >
                              <ArrowUp /> 10%
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {selected ? (
            <BinDetail bin={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <Card>
              <EmptyState icon={MapPin} title="Select a bin" description="Click a row or map marker to view details and adjust its simulated fill level." />
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardHeader icon={MapPin} title="Bin locations" description="Click a marker to select it" />
            <div className="h-80">
              <CityMap
                className="h-full w-full"
                bins={bins}
                layers={{ complaints: false, vehicles: false, routes: false }}
                selectedBinId={selectedId}
                focus={selected ? [selected.latitude, selected.longitude] : null}
                onBinSelect={setSelectedId}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
