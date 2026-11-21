'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { DEPOT } from '@/lib/mock-data'
import { pinIcon } from './map-icons'

export interface LocationPickerMapProps {
  position: { lat: number; lng: number } | null
  /** Bumped whenever the map should re-centre on `position` (search / GPS), not on manual pin moves. */
  focusKey: number
  onPick: (lat: number, lng: number) => void
}

function ClickToPick({ onPick }: { onPick: LocationPickerMapProps['onPick'] }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FocusOn({ position, focusKey }: Pick<LocationPickerMapProps, 'position' | 'focusKey'>) {
  const map = useMap()
  useEffect(() => {
    if (position && focusKey > 0) map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, map])
  return null
}

export default function LocationPickerMap({ position, focusKey, onPick }: LocationPickerMapProps) {
  return (
    <MapContainer center={[DEPOT.lat, DEPOT.lng]} zoom={13} scrollWheelZoom className="size-full cursor-crosshair">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPick onPick={onPick} />
      <FocusOn position={position} focusKey={focusKey} />
      {position && (
        <Marker
          position={[position.lat, position.lng]}
          icon={pinIcon('#dc2626', 34)}
          draggable
          autoPan
          keyboard={false}
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng()
              onPick(ll.lat, ll.lng)
            },
          }}
        />
      )}
    </MapContainer>
  )
}
