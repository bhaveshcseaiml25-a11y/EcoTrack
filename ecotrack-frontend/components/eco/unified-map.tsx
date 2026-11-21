'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { CityMap, type MapLayers } from '@/components/map'
import { Card, CardHeader } from '@/components/eco/primitives'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const TOGGLES: { key: keyof MapLayers; label: string }[] = [
  { key: 'bins', label: 'All smart bins' },
  { key: 'criticalOnly', label: 'Critical bins' },
  { key: 'complaints', label: 'Citizen complaints' },
  { key: 'vehicles', label: 'Collection vehicles' },
  { key: 'routes', label: 'Optimized routes' },
]

export function MapLegend() {
  const items = [
    { label: 'Bin 0–49%', color: '#16a34a', shape: 'rounded-[3px]' },
    { label: 'Bin 50–79%', color: '#ca8a04', shape: 'rounded-[3px]' },
    { label: 'Bin 80–99%', color: '#ea580c', shape: 'rounded-[3px]' },
    { label: 'Bin full', color: '#dc2626', shape: 'rounded-[3px]' },
    { label: 'Complaint: submitted', color: '#dc2626', shape: 'rounded-full rounded-br-none rotate-45' },
    { label: 'Under review', color: '#ea580c', shape: 'rounded-full rounded-br-none rotate-45' },
    { label: 'Assigned', color: '#2563eb', shape: 'rounded-full rounded-br-none rotate-45' },
    { label: 'Resolved', color: '#16a34a', shape: 'rounded-full rounded-br-none rotate-45' },
    { label: 'Vehicle', color: '#16243f', shape: 'rounded-full ring-2 ring-teal-500' },
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground" aria-label="Map legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn('inline-block size-2.5', i.shape)} style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function UnifiedMap({ height = 'h-[460px]', title = 'Unified city map' }: { height?: string; title?: string }) {
  const { db } = useStore()
  const router = useRouter()
  const [layers, setLayers] = useState<MapLayers>({ bins: true, criticalOnly: false, complaints: true, vehicles: true, routes: true })
  if (!db) return null

  const toggle = (key: keyof MapLayers) =>
    setLayers((l) => {
      const next = { ...l, [key]: !l[key] }
      if (key === 'bins' && next.bins) next.criticalOnly = false
      if (key === 'criticalOnly' && next.criticalOnly) next.bins = false
      return next
    })

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={MapIcon}
        title={title}
        description="Smart bins, citizen complaints, vehicles and suggested routes in one view."
      />
      <div className="flex flex-wrap gap-2 border-b px-5 py-3" role="group" aria-label="Map layers">
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={layers[t.key]}
            onClick={() => toggle(t.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              layers[t.key] ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={cn('relative w-full', height)}>
        <CityMap
          className="h-full w-full"
          bins={db.bins}
          complaints={db.complaints}
          vehicles={db.vehicles}
          routes={db.routes}
          layers={layers}
          criticalThreshold={db.settings.thresholds.warning}
          onComplaintOpen={(id) => router.push(`/complaints?id=${id}`)}
        />
      </div>
      <div className="border-t px-5 py-3">
        <MapLegend />
      </div>
    </Card>
  )
}
