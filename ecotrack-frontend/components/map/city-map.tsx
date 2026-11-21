'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { BIN_STATUS_META, CITY_CENTER, COMPLAINT_STATUS_META, ROUTE_COLORS } from '@/lib/constants'
import { formatDateTime } from '@/lib/logic'
import type { CollectionRoute, Complaint, SmartBin, Vehicle } from '@/lib/types'

export interface MapLayers {
  bins: boolean
  criticalOnly: boolean
  complaints: boolean
  vehicles: boolean
  routes: boolean
}

export interface CityMapProps {
  bins?: SmartBin[]
  complaints?: Complaint[]
  vehicles?: Vehicle[]
  routes?: CollectionRoute[]
  layers?: Partial<MapLayers>
  selectedBinId?: string | null
  focus?: [number, number] | null
  highlightRouteId?: string | null
  criticalThreshold?: number
  onBinSelect?: (id: string) => void
  onComplaintOpen?: (id: string) => void
  className?: string
  zoom?: number
}

const iconCache = new Map<string, L.DivIcon>()

function binIcon(color: string, selected: boolean) {
  const key = `bin-${color}-${selected}`
  if (!iconCache.has(key)) {
    const size = selected ? 30 : 22
    iconCache.set(
      key,
      L.divIcon({
        className: 'eco-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:7px;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;${selected ? 'outline:3px solid rgba(13,148,136,.55);' : ''}"><svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>`,
      }),
    )
  }
  return iconCache.get(key)!
}

function complaintIcon(color: string) {
  const key = `cmp-${color}`
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: 'eco-marker',
        iconSize: [26, 34],
        iconAnchor: [13, 32],
        popupAnchor: [0, -28],
        html: `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 33 13 33s12-11.5 12-20.3C25 6.2 19.6 1 13 1z" fill="${color}" stroke="#fff" stroke-width="2"/><text x="13" y="17" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="sans-serif">!</text></svg>`,
      }),
    )
  }
  return iconCache.get(key)!
}

function vehicleIcon(color: string, inactive: boolean) {
  const key = `veh-${color}-${inactive}`
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: 'eco-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<div style="width:32px;height:32px;border-radius:999px;background:${inactive ? '#64748b' : '#16243f'};border:3px solid ${color};box-shadow:0 2px 8px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`,
      }),
    )
  }
  return iconCache.get(key)!
}

function FlyTo({ focus }: { focus?: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), 15), { duration: 0.8 })
  }, [focus, map])
  return null
}

function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function CityMap({
  bins = [],
  complaints = [],
  vehicles = [],
  routes = [],
  layers = {},
  selectedBinId,
  focus,
  highlightRouteId,
  criticalThreshold = 80,
  onBinSelect,
  onComplaintOpen,
  className = 'h-96 w-full',
  zoom = 13,
}: CityMapProps) {
  const show: MapLayers = { bins: true, criticalOnly: false, complaints: true, vehicles: true, routes: true, ...layers }

  const routeColor = useMemo(() => {
    const m = new Map<string, string>()
    routes.forEach((r, i) => m.set(r.vehicleId, ROUTE_COLORS[i % ROUTE_COLORS.length]))
    return m
  }, [routes])

  const visibleBins = show.bins
    ? bins
    : show.criticalOnly
      ? bins.filter((b) => b.fillLevel >= criticalThreshold)
      : []

  return (
    <MapContainer center={CITY_CENTER} zoom={zoom} scrollWheelZoom className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo focus={focus} />
      <InvalidateOnResize />

      {show.routes &&
        routes.map((r) => {
          const v = vehicles.find((x) => x.id === r.vehicleId)
          if (!v) return null
          const color = routeColor.get(r.vehicleId)!
          const dim = highlightRouteId && highlightRouteId !== r.id
          const path: [number, number][] = [
            [v.depotLatitude, v.depotLongitude],
            ...r.orderedStops.map((s) => [s.latitude, s.longitude] as [number, number]),
            [v.depotLatitude, v.depotLongitude],
          ]
          return (
            <Polyline
              key={r.id}
              positions={path}
              pathOptions={{ color, weight: dim ? 3 : 5, opacity: dim ? 0.25 : 0.85, dashArray: r.status === 'completed' ? '6 8' : undefined }}
            >
              <Tooltip sticky>
                {v.vehicleName} · {r.orderedStops.length} stops · {r.estimatedDistance} km (simulated)
              </Tooltip>
            </Polyline>
          )
        })}

      {show.routes &&
        routes.flatMap((r) =>
          r.orderedStops.map((s, i) => (
            <CircleMarker
              key={`${r.id}-${s.binId}`}
              center={[s.latitude, s.longitude]}
              radius={0.1}
              pathOptions={{ opacity: 0 }}
            >
              <Tooltip permanent direction="top" offset={[0, -12]} className="!rounded-md !px-1.5 !py-0 !text-[10px] !font-bold">
                {i + 1}
              </Tooltip>
            </CircleMarker>
          )),
        )}

      {visibleBins.map((b) => {
        const meta = BIN_STATUS_META[b.status]
        return (
          <Marker
            key={b.id}
            position={[b.latitude, b.longitude]}
            icon={binIcon(meta.color, selectedBinId === b.id)}
            zIndexOffset={b.fillLevel * 10}
            eventHandlers={onBinSelect ? { click: () => onBinSelect(b.id) } : undefined}
          >
            {!onBinSelect && (
              <Popup>
                <p className="font-semibold">{b.id}</p>
                <p>
                  {b.location}, {b.area}
                </p>
                <p>
                  Fill level: <strong style={{ color: meta.color }}>{b.fillLevel}%</strong> ({meta.label})
                </p>
                <p>Category: {b.wasteCategory}</p>
                <p style={{ color: '#64748b' }}>Updated {formatDateTime(b.lastUpdated)}</p>
              </Popup>
            )}
          </Marker>
        )
      })}

      {show.complaints &&
        complaints.map((c) => {
          const meta = COMPLAINT_STATUS_META[c.status]
          return (
            <Marker key={c.id} position={[c.latitude, c.longitude]} icon={complaintIcon(meta.color)} zIndexOffset={2000}>
              <Popup>
                <p className="font-semibold">
                  {c.id} · <span style={{ color: meta.color }}>{meta.label}</span>
                </p>
                <p className="font-medium">{c.category}</p>
                <p style={{ maxWidth: 220 }}>{c.description.length > 110 ? `${c.description.slice(0, 110)}…` : c.description}</p>
                <p style={{ color: '#64748b' }}>
                  {c.address} ({c.latitude.toFixed(5)}, {c.longitude.toFixed(5)})
                </p>
                <p style={{ color: '#64748b' }}>Submitted {formatDateTime(c.createdAt)}</p>
                {onComplaintOpen && (
                  <button
                    type="button"
                    onClick={() => onComplaintOpen(c.id)}
                    style={{ marginTop: 6, background: '#0d9488', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
                  >
                    Open full details
                  </button>
                )}
              </Popup>
            </Marker>
          )
        })}

      {show.vehicles &&
        vehicles.map((v) => (
          <Marker
            key={v.id}
            position={[v.latitude, v.longitude]}
            icon={vehicleIcon(routeColor.get(v.id) ?? '#14b8a6', v.status === 'maintenance')}
            zIndexOffset={3000}
          >
            <Popup>
              <p className="font-semibold">{v.vehicleName}</p>
              <p>Driver: {v.driver}</p>
              <p>Status: {v.status.replace('-', ' ')}</p>
              <p>Route: {v.assignedRoute ?? 'None assigned'}</p>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  )
}
