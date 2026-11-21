'use client'

import dynamic from 'next/dynamic'
import { MapPinned } from 'lucide-react'
import { BIN_STATUS_META } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { CityMapProps } from './city-map-inner'

const CityMapInner = dynamic(() => import('./city-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full animate-pulse items-center justify-center bg-muted text-muted-foreground">
      <MapPinned className="size-6" aria-hidden />
      <span className="sr-only">Loading map</span>
    </div>
  ),
})

export function CityMap({
  className,
  legend = true,
  label = 'City map',
  ...props
}: CityMapProps & { className?: string; legend?: boolean; label?: string }) {
  return (
    <div className={cn('relative isolate overflow-hidden rounded-lg border', className)} role="region" aria-label={label}>
      <CityMapInner {...props} />
      {legend && (
        <ul className="pointer-events-none absolute bottom-2 left-2 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-card/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
          {Object.values(BIN_STATUS_META).map((m) => (
            <li key={m.label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: m.hex }} aria-hidden />
              {m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
