'use client'

import dynamic from 'next/dynamic'

export type { LeafletMapProps, MapMarker } from './leaflet-map'
export type { CityMapProps, MapLayers } from './city-map'
export type { LocationPickerMapProps } from './location-picker-map'

function MapSkeleton() {
  return (
    <div className="flex h-full min-h-64 w-full animate-pulse items-center justify-center bg-muted text-xs text-muted-foreground">
      Loading map…
    </div>
  )
}

// Leaflet accesses `window` at import time, so maps must only load in the browser.
export const Map = dynamic(() => import('./leaflet-map'), { ssr: false, loading: MapSkeleton })
export const CityMap = dynamic(() => import('./city-map'), { ssr: false, loading: MapSkeleton })
export const LocationPickerMap = dynamic(() => import('./location-picker-map'), { ssr: false, loading: MapSkeleton })
