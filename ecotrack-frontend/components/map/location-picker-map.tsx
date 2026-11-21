'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { CITY_CENTER } from '@/lib/constants'

export interface LocationPickerMapProps {
  value: { lat: number; lng: number } | null
  onChange: (pos: { lat: number; lng: number }) => void
  flyTarget?: { lat: number; lng: number; key: number } | null
  className?: string
}

const pinIcon = L.divIcon({
  className: 'eco-marker',
  iconSize: [32, 42],
  iconAnchor: [16, 40],
  html: `<svg width="32" height="42" viewBox="0 0 32 42"><path d="M16 1C7.7 1 1 7.5 1 15.6 1 26.6 16 41 16 41s15-14.4 15-25.4C31 7.5 24.3 1 16 1z" fill="#0d9488" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="15.5" r="5.5" fill="#fff"/></svg>`,
})

function ClickHandler({ onChange }: { onChange: LocationPickerMapProps['onChange'] }) {
  useMapEvents({
    click: (e) => onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }),
  })
  return null
}

function Fly({ target }: { target: LocationPickerMapProps['flyTarget'] }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 17, { duration: 0.8 })
  }, [target, map])
  return null
}

export default function LocationPickerMap({ value, onChange, flyTarget, className = 'h-72 w-full' }: LocationPickerMapProps) {
  const handlers = useMemo(
    () => ({
      dragend: (e: L.DragEndEvent) => {
        const p = (e.target as L.Marker).getLatLng()
        onChange({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) })
      },
    }),
    [onChange],
  )
  return (
    <MapContainer center={CITY_CENTER} zoom={13} scrollWheelZoom className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      <Fly target={flyTarget} />
      {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} draggable eventHandlers={handlers} />}
    </MapContainer>
  )
}
