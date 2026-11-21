import L from 'leaflet'

const cache = new Map<string, L.DivIcon>()

/** Teardrop pin whose tip sits exactly on the coordinate. */
export function pinIcon(color: string, size = 30) {
  const key = `${color}-${size}`
  const cached = cache.get(key)
  if (cached) return cached
  const h = Math.round(size * 1.3)
  const icon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 30 39" style="filter:drop-shadow(0 2px 3px rgba(15,23,42,.35))"><path d="M15 38s13-12.4 13-23A13 13 0 0 0 2 15c0 10.6 13 23 13 23z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="15" cy="15" r="5" fill="white"/></svg>`,
    iconSize: [size, h],
    iconAnchor: [size / 2, h - 1],
    popupAnchor: [0, -h + 6],
  })
  cache.set(key, icon)
  return icon
}
