import { DEPOT } from './mock-data'

/**
 * Geocoding via OpenStreetMap Nominatim. Kept behind this small interface so it can be
 * swapped for a server-side proxy (with caching and rate limiting) once a backend exists.
 * Nominatim's usage policy allows ~1 request/second and forbids autocomplete-style use,
 * so callers should only search on explicit submit.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org'
const SEARCH_RADIUS_DEG = 0.2

export interface GeocodeResult {
  id: string
  label: string
  shortLabel: string
  lat: number
  lng: number
}

interface NominatimPlace {
  place_id: number
  display_name: string
  lat: string
  lon: string
  name?: string
  address?: Record<string, string>
}

function shortLabel(p: NominatimPlace) {
  const a = p.address ?? {}
  const parts = [a.road ?? p.name, a.neighbourhood ?? a.suburb].filter(Boolean)
  return parts.length ? parts.join(', ') : p.display_name.split(',').slice(0, 2).join(',').trim()
}

function toResult(p: NominatimPlace): GeocodeResult {
  return { id: String(p.place_id), label: p.display_name, shortLabel: shortLabel(p), lat: Number(p.lat), lng: Number(p.lon) }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const viewbox = [
    DEPOT.lng - SEARCH_RADIUS_DEG,
    DEPOT.lat + SEARCH_RADIUS_DEG,
    DEPOT.lng + SEARCH_RADIUS_DEG,
    DEPOT.lat - SEARCH_RADIUS_DEG,
  ].join(',')
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '5', viewbox, bounded: '1' })
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  return ((await res.json()) as NominatimPlace[]).map(toResult)
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', zoom: '18' })
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = (await res.json()) as NominatimPlace & { error?: string }
  return data.error ? null : toResult(data)
}
