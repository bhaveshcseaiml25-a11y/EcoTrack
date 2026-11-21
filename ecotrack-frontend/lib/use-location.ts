'use client'
import { useEffect, useState } from 'react'

const FALLBACK = 'Greenhaven'
const CACHE_KEY = 'ecotrack-city-name'

export function useLiveLocation() {
  const [label, setLabel] = useState(FALLBACK)

  useEffect(() => {
    if (!navigator.geolocation) return

    // show the last known city immediately (avoids flicker on reload)
    try {
      const cached = window.localStorage.getItem(CACHE_KEY)
      if (cached) setLabel(cached)
    } catch {}

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: { 'Accept-Language': 'en' } },
          )
          const data = await res.json()
          const a = data.address ?? {}
          const city = a.city || a.town || a.village || a.suburb || a.county || a.state_district || a.state
          if (city) {
            setLabel(city)
            try {
              window.localStorage.setItem(CACHE_KEY, city)
            } catch {}
          }
        } catch {
          // network error: keep whatever label is already shown
        }
      },
      () => {}, // permission denied or failed: keep the fallback
      { timeout: 10000 },
    )
  }, [])

  return label
}