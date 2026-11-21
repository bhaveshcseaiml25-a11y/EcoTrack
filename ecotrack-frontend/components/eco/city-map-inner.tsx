'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { BIN_STATUS_META, getBinStatus } from '@/lib/domain'
import { DEPOT } from '@/lib/mock-data'
import type { Bin, CollectionRoute, Complaint, Vehicle } from '@/lib/types'

export interface CityMapProps {
  bins?: Bin[]
  vehicles?: Vehicle[]
  complaints?: Complaint[]
  routes?: CollectionRoute[]
  highlightRouteId?: string | null
  selectedBinId?: string | null
  onBinClick?: (bin: Bin) => void
  onComplaintClick?: (c: Complaint) => void
  showDepot?: boolean
}

const truckSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'

function vehicleIcon(color: string, dim: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:${color};box-shadow:0 2px 6px rgba(15,23,42,.35);border:2px solid white;opacity:${dim ? 0.55 : 1}">${truckSvg}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const depotIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:4px;background:#1e293b;border:3px solid white;box-shadow:0 2px 6px rgba(15,23,42,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

export default function CityMapInner({
  bins = [],
  vehicles = [],
  complaints = [],
  routes = [],
  highlightRouteId,
  selectedBinId,
  onBinClick,
  onComplaintClick,
  showDepot,
}: CityMapProps) {
  const binById = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins])
  const vehicleRoute = useMemo(() => new Map(routes.map((r) => [r.vehicleId, r])), [routes])

  const points = useMemo<[number, number][]>(
    () => [
      ...bins.map((b) => [b.lat, b.lng] as [number, number]),
      ...vehicles.map((v) => [v.lat, v.lng] as [number, number]),
      ...complaints.map((c) => [c.lat, c.lng] as [number, number]),
    ],
    [bins, vehicles, complaints],
  )

  return (
    <MapContainer
      center={[DEPOT.lat, DEPOT.lng]}
      zoom={13}
      scrollWheelZoom={false}
      className="size-full"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />

      {routes.map((r) => {
        const vehicle = vehicles.find((v) => v.id === r.vehicleId)
        const stopPoints = r.stops
          .map((id) => binById.get(id))
          .filter(Boolean)
          .map((b) => [b!.lat, b!.lng] as [number, number])
        const path: [number, number][] = [
          ...(vehicle && r.status === 'pending' ? [[vehicle.lat, vehicle.lng] as [number, number]] : []),
          ...stopPoints,
          [DEPOT.lat, DEPOT.lng],
        ]
        const dim = highlightRouteId ? highlightRouteId !== r.id : false
        return (
          <Polyline
            key={r.id}
            positions={path}
            pathOptions={{
              color: r.color,
              weight: dim ? 3 : 5,
              opacity: dim ? 0.25 : 0.9,
              dashArray: r.status === 'completed' ? '6 8' : undefined,
            }}
          />
        )
      })}

      {bins.map((b) => {
        const meta = BIN_STATUS_META[getBinStatus(b.fillLevel)]
        const selected = selectedBinId === b.id
        return (
          <CircleMarker
            key={b.id}
            center={[b.lat, b.lng]}
            radius={selected ? 11 : 7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: meta.hex, fillOpacity: 0.95 }}
            eventHandlers={onBinClick ? { click: () => onBinClick(b) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div className="text-xs">
                <p className="font-semibold">{b.id}</p>
                <p>
                  {b.location}, {b.area}
                </p>
                <p>
                  {b.fillLevel}% · {meta.label}
                </p>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}

      {complaints.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={8}
          pathOptions={{
            color: '#1e293b',
            weight: 2,
            fillColor: c.status === 'Resolved' ? '#22a06b' : '#6366f1',
            fillOpacity: 0.9,
          }}
          eventHandlers={onComplaintClick ? { click: () => onComplaintClick(c) } : undefined}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <div className="text-xs">
              <p className="font-semibold">{c.id}</p>
              <p>{c.category}</p>
              <p>
                {c.address} · {c.status}
              </p>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {vehicles.map((v) => {
        const route = vehicleRoute.get(v.id)
        const color = route?.color ?? (v.status === 'maintenance' ? '#94a3b8' : '#1e293b')
        const dim = highlightRouteId ? route?.id !== highlightRouteId : false
        return (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={vehicleIcon(color, dim)}>
            <Tooltip direction="top" offset={[0, -14]}>
              <div className="text-xs">
                <p className="font-semibold">
                  {v.name} · {v.id}
                </p>
                <p>
                  {v.driver} · {v.status.replace('-', ' ')}
                </p>
                <p>Load {v.loadPct}%</p>
              </div>
            </Tooltip>
          </Marker>
        )
      })}

      {showDepot && (
        <Marker position={[DEPOT.lat, DEPOT.lng]} icon={depotIcon}>
          <Tooltip direction="top" offset={[0, -10]}>
            {DEPOT.name}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}
