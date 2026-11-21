import type {
  Alert,
  AlertSeverity,
  AlertThresholds,
  BinStatus,
  CollectionRoute,
  SmartBin,
  Vehicle,
} from './types'

export function clampFill(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function getBinStatus(fillLevel: number): BinStatus {
  if (fillLevel >= 100) return 'full'
  if (fillLevel >= 80) return 'almost-full'
  if (fillLevel >= 50) return 'moderate'
  return 'normal'
}

export function getAlertTier(fillLevel: number, t: AlertThresholds): number {
  if (fillLevel >= t.critical) return 3
  if (fillLevel >= t.high) return 2
  if (fillLevel >= t.warning) return 1
  return 0
}

const TIER_SEVERITY: Record<number, AlertSeverity> = { 1: 'warning', 2: 'high', 3: 'critical' }

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

/**
 * Applies a new fill level and returns the updated bin plus any alert raised.
 * An alert is raised only when the bin crosses into a tier higher than any already
 * alerted since it was last emptied, which prevents duplicates for the same crossing.
 * Dropping below the warning threshold (e.g. after collection) re-arms the bin.
 */
export function applyFillLevel(
  bin: SmartBin,
  fillLevel: number,
  thresholds: AlertThresholds,
  now = new Date().toISOString(),
): { bin: SmartBin; alert: Alert | null } {
  const level = clampFill(fillLevel)
  const tier = getAlertTier(level, thresholds)
  const next: SmartBin = { ...bin, fillLevel: level, status: getBinStatus(level), lastUpdated: now }
  let alert: Alert | null = null

  if (tier === 0) {
    next.alertTier = 0
  } else if (tier > bin.alertTier) {
    next.alertTier = tier
    alert = {
      id: makeId('ALT'),
      binId: bin.id,
      location: `${bin.location}, ${bin.area}`,
      severity: TIER_SEVERITY[tier],
      fillLevel: level,
      timestamp: now,
      isRead: false,
      isResolved: false,
    }
  }
  return { bin: next, alert }
}

/** Resolves older open alerts for a bin when it escalates or is emptied. */
export function reconcileAlerts(alerts: Alert[], bin: SmartBin, newAlert: Alert | null, now: string): Alert[] {
  let result = alerts
  if (newAlert || bin.alertTier === 0) {
    result = result.map((a) =>
      a.binId === bin.id && !a.isResolved
        ? {
            ...a,
            isResolved: true,
            resolvedAt: now,
            note: newAlert ? `Escalated to ${newAlert.severity}` : 'Bin emptied',
          }
        : a,
    )
  }
  return newAlert ? [newAlert, ...result] : result
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Straight-line distance inflated by a typical urban road-network factor. Simulated until a routing API is used. */
const ROAD_FACTOR = 1.35
const AVG_SPEED_KMH = 22
const MINUTES_PER_STOP = 4

type Point = { latitude: number; longitude: number }

function pathDistance(start: Point, stops: Point[]) {
  let dist = 0
  let cur = start
  for (const s of stops) {
    dist += haversineKm(cur.latitude, cur.longitude, s.latitude, s.longitude)
    cur = s
  }
  dist += haversineKm(cur.latitude, cur.longitude, start.latitude, start.longitude)
  return dist * ROAD_FACTOR
}

function estimateMinutes(distanceKm: number, stops: number) {
  return Math.round((distanceKm / AVG_SPEED_KMH) * 60 + stops * MINUTES_PER_STOP)
}

function nearestNeighbourOrder<T extends Point>(start: Point, points: T[]): T[] {
  const remaining = [...points]
  const ordered: T[] = []
  let cur: Point = start
  while (remaining.length) {
    let best = 0
    let bestD = Infinity
    remaining.forEach((p, i) => {
      const d = haversineKm(cur.latitude, cur.longitude, p.latitude, p.longitude)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    const [next] = remaining.splice(best, 1)
    ordered.push(next)
    cur = next
  }
  return ordered
}

/** 2-opt improvement pass over a nearest-neighbour tour. */
function twoOpt<T extends Point>(start: Point, order: T[]): T[] {
  let best = [...order]
  let bestD = pathDistance(start, best)
  let improved = true
  let guard = 0
  while (improved && guard++ < 50) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)]
        const d = pathDistance(start, candidate)
        if (d + 1e-9 < bestD) {
          best = candidate
          bestD = d
          improved = true
        }
      }
    }
  }
  return best
}

/**
 * Simulated route optimizer: assigns bins needing collection to the nearest available
 * vehicle depot (with load balancing), then orders stops with nearest-neighbour + 2-opt.
 * Replace with a backend VRP solver by swapping `api.generateRoutes`.
 */
export function optimizeRoutes(
  bins: SmartBin[],
  vehicles: Vehicle[],
  thresholds: AlertThresholds,
  now = new Date().toISOString(),
): CollectionRoute[] {
  const targets = bins.filter((b) => b.fillLevel >= thresholds.warning)
  const fleet = vehicles.filter((v) => v.status !== 'maintenance')
  if (!targets.length || !fleet.length) return []

  const maxPerVehicle = Math.ceil(targets.length / fleet.length) + 1
  const buckets = new Map<string, SmartBin[]>(fleet.map((v) => [v.id, []]))

  const sorted = [...targets].sort((a, b) => b.fillLevel - a.fillLevel)
  for (const bin of sorted) {
    const ranked = [...fleet].sort(
      (a, b) =>
        haversineKm(a.depotLatitude, a.depotLongitude, bin.latitude, bin.longitude) -
        haversineKm(b.depotLatitude, b.depotLongitude, bin.latitude, bin.longitude),
    )
    const vehicle = ranked.find((v) => buckets.get(v.id)!.length < maxPerVehicle) ?? ranked[0]
    buckets.get(vehicle.id)!.push(bin)
  }

  const routes: CollectionRoute[] = []
  fleet.forEach((vehicle, idx) => {
    const assigned = buckets.get(vehicle.id)!
    if (!assigned.length) return
    const depot = { latitude: vehicle.depotLatitude, longitude: vehicle.depotLongitude }
    const ordered = twoOpt(depot, nearestNeighbourOrder(depot, assigned))
    const baselineOrder = [...assigned].sort((a, b) => a.id.localeCompare(b.id))
    const estimatedDistance = pathDistance(depot, ordered)
    const baselineDistance = Math.max(pathDistance(depot, baselineOrder), estimatedDistance)
    routes.push({
      id: `RT-${String(idx + 1).padStart(2, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      vehicleId: vehicle.id,
      binIds: ordered.map((b) => b.id),
      orderedStops: ordered.map((b) => ({
        binId: b.id,
        location: `${b.location}, ${b.area}`,
        latitude: b.latitude,
        longitude: b.longitude,
        collected: false,
      })),
      estimatedDistance: Math.round(estimatedDistance * 10) / 10,
      estimatedTime: estimateMinutes(estimatedDistance, ordered.length),
      baselineDistance: Math.round(baselineDistance * 10) / 10,
      baselineTime: estimateMinutes(baselineDistance, ordered.length),
      status: 'scheduled',
      createdAt: now,
    })
  })
  return routes
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}
