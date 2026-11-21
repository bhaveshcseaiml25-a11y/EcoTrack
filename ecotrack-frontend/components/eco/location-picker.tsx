'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, MapPinned, Search, X } from 'lucide-react'
import { formatCoords } from '@/lib/domain'
import { reverseGeocode, searchPlaces, type GeocodeResult } from '@/lib/geocoding'
import type { PickedLocation } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from './primitives'

const LocationPickerMap = dynamic(() => import('./location-picker-map'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full animate-pulse items-center justify-center bg-muted text-muted-foreground">
      <MapPinned className="size-6" aria-hidden />
      <span className="sr-only">Loading map</span>
    </div>
  ),
})

interface LocationPickerProps {
  value: PickedLocation | null
  onChange: (value: PickedLocation | null) => void
  required?: boolean
  error?: string
  id?: string
  className?: string
}

export function LocationPicker({ value, onChange, required, error, id = 'location', className }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [focusKey, setFocusKey] = useState(0)
  const reverseCtrl = useRef<AbortController | null>(null)
  const searchCtrl = useRef<AbortController | null>(null)

  async function resolveAddress(next: PickedLocation) {
    reverseCtrl.current?.abort()
    const ctrl = new AbortController()
    reverseCtrl.current = ctrl
    setResolving(true)
    try {
      const place = await reverseGeocode(next.lat, next.lng, ctrl.signal)
      if (!ctrl.signal.aborted) onChange({ ...next, address: place?.shortLabel })
    } catch {
      // Address lookup is best-effort; coordinates remain the source of truth.
    } finally {
      if (!ctrl.signal.aborted) setResolving(false)
    }
  }

  function pick(lat: number, lng: number, source: PickedLocation['source'], address?: string, recentre = false) {
    const next: PickedLocation = { lat, lng, source, address }
    onChange(next)
    if (recentre) setFocusKey((k) => k + 1)
    if (!address) resolveAddress(next)
    else {
      reverseCtrl.current?.abort()
      setResolving(false)
    }
  }

  async function runSearch() {
    const q = query.trim()
    if (q.length < 3) return setSearchError('Type at least 3 characters.')
    searchCtrl.current?.abort()
    const ctrl = new AbortController()
    searchCtrl.current = ctrl
    setSearching(true)
    setSearchError(null)
    try {
      const found = await searchPlaces(q, ctrl.signal)
      setResults(found)
      if (!found.length) setSearchError('No places found near the city. Try a nearby landmark.')
    } catch {
      if (!ctrl.signal.aborted) setSearchError('Search is unavailable right now. Drop a pin on the map instead.')
    } finally {
      if (!ctrl.signal.aborted) setSearching(false)
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) return setSearchError('Your browser does not support location access.')
    setLocating(true)
    setSearchError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        pick(pos.coords.latitude, pos.coords.longitude, 'gps', undefined, true)
      },
      (err) => {
        setLocating(false)
        setSearchError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Search or drop a pin instead.'
            : 'Could not get your location. Search or drop a pin instead.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const statusId = `${id}-status`
  const errorId = `${id}-error`

  return (
    <fieldset className={cn('flex flex-col gap-2', className)} aria-describedby={`${statusId}${error ? ` ${errorId}` : ''}`}>
      <legend className="mb-1.5 text-sm font-medium">
        Pin the exact location{' '}
        <span className="font-normal text-muted-foreground">{required ? '(required for this issue)' : '(optional)'}</span>
      </legend>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor={`${id}-search`} className="sr-only">
            Search for an address or area
          </label>
          <Input
            id={`${id}-search`}
            type="search"
            placeholder="Search an address, street or landmark"
            className="pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchError(null)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              runSearch()
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={runSearch} disabled={searching} className="flex-1 sm:flex-none">
            {searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Search
          </Button>
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="flex-1 sm:flex-none">
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
            Use my location
          </Button>
        </div>
      </div>

      {results && results.length > 0 && (
        <ul className="overflow-hidden rounded-lg border bg-card text-sm" aria-label="Search results">
          {results.map((r) => (
            <li key={r.id} className="border-b last:border-b-0">
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  pick(r.lat, r.lng, 'search', r.shortLabel, true)
                  setResults(null)
                  setQuery(r.shortLabel)
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{r.shortLabel}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchError && (
        <p className="text-xs text-muted-foreground" role="status">
          {searchError}
        </p>
      )}

      <div
        className={cn('relative isolate h-72 overflow-hidden rounded-lg border sm:h-80', error && 'border-destructive')}
        role="region"
        aria-label="Map for selecting the complaint location. Click to drop a pin, drag the pin to adjust."
      >
        <LocationPickerMap position={value} focusKey={focusKey} onPick={(lat, lng) => pick(lat, lng, 'pin')} />
        {!value && (
          <p className="pointer-events-none absolute top-2 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 text-xs font-medium shadow-sm">
            Click the map to drop a pin
          </p>
        )}
      </div>

      <div
        id={statusId}
        aria-live="polite"
        className={cn(
          'flex items-start gap-3 rounded-lg border p-3 text-sm',
          value ? 'border-primary/30 bg-primary/5' : 'border-dashed text-muted-foreground',
        )}
      >
        <MapPin className={cn('mt-0.5 size-4 shrink-0', value && 'text-primary')} aria-hidden />
        {value ? (
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {resolving ? 'Looking up address…' : (value.address ?? 'Pinned location')}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatCoords(value.lat, value.lng)} · via {value.source === 'gps' ? 'your device' : value.source === 'search' ? 'search' : 'map pin'}
            </p>
          </div>
        ) : (
          <p className="flex-1">No location selected yet.</p>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              reverseCtrl.current?.abort()
              setResolving(false)
              onChange(null)
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear selected location"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
