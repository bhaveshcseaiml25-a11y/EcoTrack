'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Battery, MapPinned, Search, SlidersHorizontal, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/lib/store'
import { BIN_STATUS_META, BIN_STATUSES, formatDateTime, getBinStatus, timeAgo, WASTE_CATEGORIES } from '@/lib/domain'
import type { Bin, BinStatus, WasteCategory } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Drawer, EmptyState, FillBar, Input, KeyValue, PageHeader, Segmented, Select, SimulatedTag } from '../primitives'
import { BinStatusBadge } from '../badges'
import { CityMap } from '../city-map'

function BinDrawer({ bin, onClose }: { bin: Bin | null; onClose: () => void }) {
  const { updateFill } = useStore()
  const now = useNow()
  const [draft, setDraft] = useState<number | null>(null)
  if (!bin) return null
  const value = draft ?? bin.fillLevel
  const meta = BIN_STATUS_META[getBinStatus(value)]

  return (
    <Drawer
      open={!!bin}
      onClose={() => {
        setDraft(null)
        onClose()
      }}
      title={bin.id}
      description={`${bin.location}, ${bin.area}`}
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              updateFill(bin.id, 0, 'collection')
              setDraft(null)
              toast.success(`${bin.id} marked as collected`, { description: 'Fill level reset to 0%. Related alerts resolved.' })
            }}
          >
            Mark collected
          </Button>
          <Button
            className="flex-1"
            disabled={draft === null || draft === bin.fillLevel}
            onClick={() => {
              updateFill(bin.id, value, 'manual')
              setDraft(null)
              toast.success(`Sensor reading updated to ${value}%`)
            }}
          >
            Apply reading
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border bg-muted/40 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current fill level</p>
              <p className="text-4xl font-semibold tabular-nums">{value}%</p>
            </div>
            <BinStatusBadge fillLevel={value} />
          </div>
          <FillBar value={value} color={meta.color} className="mt-4 h-3" />
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <KeyValue label="Category" value={bin.category} />
          <KeyValue label="Capacity" value={`${bin.capacityLiters} L`} />
          <KeyValue label="Last updated" value={timeAgo(bin.lastUpdated, now)} />
          <KeyValue label="Last collected" value={formatDateTime(bin.lastCollected)} />
          <KeyValue
            label="Sensor battery"
            value={
              <span className={cn('inline-flex items-center gap-1', bin.sensorBattery < 25 && 'text-critical')}>
                <Battery className="size-3.5" aria-hidden />
                {bin.sensorBattery}%
              </span>
            }
          />
          <KeyValue label="Coordinates" value={`${bin.lat.toFixed(4)}, ${bin.lng.toFixed(4)}`} />
        </dl>

        <CityMap className="h-48" bins={[bin]} selectedBinId={bin.id} legend={false} label={`Location of ${bin.id}`} />

        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="fill-sim" className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
              Simulate sensor reading
            </label>
            <SimulatedTag />
          </div>
          <input
            id="fill-sim"
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setDraft(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Apply a reading to trigger the automated alert engine. Crossing thresholds creates or escalates alerts instantly.
          </p>
        </div>
      </div>
    </Drawer>
  )
}

export function BinsView() {
  const { state, simulateTick } = useStore()
  const now = useNow()
  const params = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('all')
  const [status, setStatus] = useState<'all' | BinStatus>('all')
  const [category, setCategory] = useState<'all' | WasteCategory>('all')
  const [sort, setSort] = useState<'fill-desc' | 'fill-asc' | 'id' | 'updated'>('fill-desc')
  const [view, setView] = useState<'table' | 'grid'>('table')

  const selectedId = params.get('bin')
  const selected = state.bins.find((b) => b.id === selectedId) ?? null
  const areas = useMemo(() => [...new Set(state.bins.map((b) => b.area))].sort(), [state.bins])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = state.bins.filter(
      (b) =>
        (!q || b.id.toLowerCase().includes(q) || b.location.toLowerCase().includes(q) || b.area.toLowerCase().includes(q)) &&
        (area === 'all' || b.area === area) &&
        (status === 'all' || getBinStatus(b.fillLevel) === status) &&
        (category === 'all' || b.category === category),
    )
    return list.sort((a, b) => {
      if (sort === 'fill-desc') return b.fillLevel - a.fillLevel
      if (sort === 'fill-asc') return a.fillLevel - b.fillLevel
      if (sort === 'updated') return +new Date(b.lastUpdated) - +new Date(a.lastUpdated)
      return a.id.localeCompare(b.id)
    })
  }, [state.bins, query, area, status, category, sort])

  const openBin = (id: string | null) => router.replace(id ? `/bins?bin=${id}` : '/bins', { scroll: false })
  const counts = BIN_STATUSES.map((s) => ({ s, n: state.bins.filter((b) => getBinStatus(b.fillLevel) === s).length }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Smart Bin Monitoring"
        description="Real-time ultrasonic sensor readings from every connected bin. Select a bin to inspect it or simulate a new reading."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              simulateTick()
              toast.info('Sensor sweep received', { description: 'Fill levels refreshed from simulated telemetry.' })
            }}
          >
            <Zap className="size-4" aria-hidden /> Simulate sensor sweep
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(({ s, n }) => {
          const meta = BIN_STATUS_META[s]
          const active = status === s
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(active ? 'all' : s)}
              className={cn(
                'flex items-center justify-between rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                active && 'ring-2 ring-primary',
              )}
            >
              <span>
                <span className="block text-xs text-muted-foreground">
                  {meta.label} · {meta.range}
                </span>
                <span className="mt-1 block text-2xl font-semibold tabular-nums">{n}</span>
              </span>
              <span className={cn('size-3 rounded-full', meta.color)} aria-hidden />
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader icon={MapPinned} title="Bin locations" description={`${filtered.length} bins match current filters`} />
        <div className="p-5 pt-4">
          <CityMap className="h-[340px]" bins={filtered} selectedBinId={selectedId} onBinClick={(b) => openBin(b.id)} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search by bin ID, street or area"
              aria-label="Search bins"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select aria-label="Filter by area" value={area} onChange={(e) => setArea(e.target.value)} className="sm:w-40">
              <option value="all">All areas</option>
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="sm:w-36">
              <option value="all">All statuses</option>
              {BIN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BIN_STATUS_META[s].label}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="sm:w-36">
              <option value="all">All categories</option>
              {WASTE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select aria-label="Sort bins" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="sm:w-40">
              <option value="fill-desc">Fill: high to low</option>
              <option value="fill-asc">Fill: low to high</option>
              <option value="updated">Recently updated</option>
              <option value="id">Bin ID</option>
            </Select>
          </div>
          <Segmented
            label="Layout"
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'grid', label: 'Cards' },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="No bins match your filters"
            description="Try clearing the search or selecting a different area or status."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setArea('all')
                  setStatus('all')
                  setCategory('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Bin ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Location</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="w-56 px-4 py-3 font-medium">Fill level</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const meta = BIN_STATUS_META[getBinStatus(b.fillLevel)]
                  return (
                    <tr
                      key={b.id}
                      onClick={() => openBin(b.id)}
                      className={cn('cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60', selectedId === b.id && 'bg-primary/5')}
                    >
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openBin(b.id)} className="font-mono text-xs font-semibold hover:text-primary">
                          {b.id}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.location}</p>
                        <p className="text-xs text-muted-foreground">{b.area}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <FillBar value={b.fillLevel} color={meta.color} />
                          <span className="w-10 text-right font-semibold tabular-nums">{b.fillLevel}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <BinStatusBadge fillLevel={b.fillLevel} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(b.lastUpdated, now)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map((b) => {
              const meta = BIN_STATUS_META[getBinStatus(b.fillLevel)]
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => openBin(b.id)}
                    className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold">{b.id}</p>
                        <p className="truncate text-sm font-medium">{b.location}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.area} · {b.category}
                        </p>
                      </div>
                      <BinStatusBadge fillLevel={b.fillLevel} />
                    </div>
                    <div className="flex items-center gap-3">
                      <FillBar value={b.fillLevel} color={meta.color} />
                      <span className="w-10 text-right text-sm font-semibold tabular-nums">{b.fillLevel}%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Updated {timeAgo(b.lastUpdated, now)}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <BinDrawer key={selected?.id} bin={selected} onClose={() => openBin(null)} />
      <span className="sr-only" aria-live="polite">
        {filtered.length} bins shown
      </span>
    </div>
  )
}
