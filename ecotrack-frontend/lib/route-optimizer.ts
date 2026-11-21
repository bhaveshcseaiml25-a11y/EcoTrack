import { ROUTE_COLORS } from './domain'
import { DEPOT } from './mock-data'
import type { Bin, CollectionRoute, RoutePlan, Vehicle } from './types'

/**
 * Contract for any route optimization engine. The default implementation runs a
 * simple local heuristic; swap in `createRemoteOptimizer(endpoint)` to delegate
 * to a backend solver (VRP, OR-Tools, etc.) without touching the UI.
 */
export interface RouteOptimizer {
  optimize(input: { bins: Bin[]; vehicles: Vehicle[] }): Promise<RoutePlan>
}

const ROAD_FACTOR = 1.35
const AVG_SPEED_KMH = 22
const SERVICE_MIN_PER_STOP = 4

type Point = { lat: number; lng: number }

export function haversineKm(a: Point, b: Point) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pathDistance(points: Point[]) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += haversineKm(points[i - 1], points[i])
  return d * ROAD_FACTOR
}

function clusterBins(bins: Bin[], k: number): Bin[][] {
  if (k <= 1) return [bins]
  const sorted = [...bins].sort(
    (a, b) =>
      Math.atan2(a.lat - DEPOT.lat, a.lng - DEPOT.lng) - Math.atan2(b.lat - DEPOT.lat, b.lng - DEPOT.lng),
  )
  const size = Math.ceil(sorted.length / k)
  const groups: Bin[][] = []
  for (let i = 0; i < sorted.length; i += size) groups.push(sorted.slice(i, i + size))
  return groups
}

function nearestNeighbourOrder(start: Point, bins: Bin[]) {
  const remaining = [...bins]
  const ordered: Bin[] = []
  let current = start
  while (remaining.length) {
    let best = 0
    let bestD = Infinity
    remaining.forEach((b, i) => {
      const d = haversineKm(current, b) - b.fillLevel / 1000
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    const [next] = remaining.splice(best, 1)
    ordered.push(next)
    current = next
  }
  return ordered
}

function closestVehicle(centroid: Point, vehicles: Vehicle[]) {
  return vehicles.reduce((best, v) => (haversineKm(centroid, v) < haversineKm(centroid, best) ? v : best))
}

export const localHeuristicOptimizer: RouteOptimizer = {
  async optimize({ bins, vehicles }) {
    await new Promise((r) => setTimeout(r, 1400))

    const fleet = vehicles.filter((v) => v.status !== 'maintenance')
    if (!fleet.length) throw new Error('No vehicles available for assignment.')
    if (!bins.length) throw new Error('No bins currently require collection.')

    const k = Math.min(fleet.length, Math.max(1, Math.ceil(bins.length / 4)))
    const clusters = clusterBins(bins, k)
    const pool = [...fleet]

    const routes: CollectionRoute[] = clusters.map((cluster, i) => {
      const centroid = {
        lat: cluster.reduce((s, b) => s + b.lat, 0) / cluster.length,
        lng: cluster.reduce((s, b) => s + b.lng, 0) / cluster.length,
      }
      const vehicle = closestVehicle(centroid, pool)
      pool.splice(pool.indexOf(vehicle), 1)
      const ordered = nearestNeighbourOrder(vehicle, cluster)
      const distanceKm = pathDistance([vehicle, ...ordered, DEPOT])
      return {
        id: `R${i + 1}`,
        vehicleId: vehicle.id,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        stops: ordered.map((b) => b.id),
        completedStops: 0,
        distanceKm: Number(distanceKm.toFixed(1)),
        durationMin: Math.round((distanceKm / AVG_SPEED_KMH) * 60 + ordered.length * SERVICE_MIN_PER_STOP),
        status: 'pending',
      }
    })

    const baselineDistanceKm = clusters.reduce((sum, _cluster, i) => {
      const naive = bins.filter((_, idx) => idx % clusters.length === i)
      return sum + pathDistance([DEPOT, ...naive, DEPOT])
    }, 0)
    const totalDistanceKm = routes.reduce((s, r) => s + r.distanceKm, 0)
    const timeSavedMin = Math.max(
      0,
      Math.round(((baselineDistanceKm - totalDistanceKm) / AVG_SPEED_KMH) * 60),
    )

    return {
      id: `PLAN-${Date.now().toString(36).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      routes,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      baselineDistanceKm: Number(baselineDistanceKm.toFixed(1)),
      timeSavedMin,
      isSimulated: true,
    }
  },
}

export function createRemoteOptimizer(endpoint: string): RouteOptimizer {
  return {
    async optimize(input) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`Optimizer responded with ${res.status}`)
      return (await res.json()) as RoutePlan
    },
  }
}

export const routeOptimizer: RouteOptimizer = localHeuristicOptimizer
