import { AREAS } from './constants'
import type { Database } from './types'

export interface AnalyticsQuery {
  days: 7 | 30 | 90
  area: string
}

function seededNoise(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const AREA_WEIGHT: Record<string, number> = {
  'Central District': 1.25,
  Riverside: 0.9,
  'North Hills': 0.75,
  'Tech Park': 1.1,
  'Old Town': 1.05,
  'Harbor View': 0.95,
}

export function buildAnalytics(db: Database, { days, area }: AnalyticsQuery) {
  const areas = area === 'all' ? [...AREAS] : [area]
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    const dayIndex = Math.floor(d.getTime() / 86400000)
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.18 : 1
    let collected = 0
    let generated = 0
    areas.forEach((a, ai) => {
      const base = 820 * AREA_WEIGHT[a] * weekend
      const g = base * (0.88 + seededNoise(dayIndex + ai * 97) * 0.28)
      generated += g
      // Optimized routing (simulated) gradually improves the share collected.
      collected += g * (0.84 + (i / days) * 0.1 + seededNoise(dayIndex * 3 + ai) * 0.04)
    })
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      collected: Math.round(collected),
      generated: Math.round(generated),
      efficiency: Math.round((collected / generated) * 1000) / 10,
    }
  })

  const weekly: { label: string; collected: number }[] = []
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7)
    weekly.push({ label: `Wk of ${chunk[0].label}`, collected: chunk.reduce((s, d) => s + d.collected, 0) })
  }

  const areaWise = areas.map((a, ai) => ({
    area: a,
    tonnes: Math.round(
      daily.reduce((s, d, di) => s + 820 * AREA_WEIGHT[a] * (0.88 + seededNoise(di + ai * 97) * 0.28), 0) / 100,
    ) / 10,
  }))

  const bins = area === 'all' ? db.bins : db.bins.filter((b) => b.area === area)
  const fillDistribution = [
    { name: 'Normal', value: bins.filter((b) => b.status === 'normal').length, color: '#16a34a' },
    { name: 'Moderate', value: bins.filter((b) => b.status === 'moderate').length, color: '#ca8a04' },
    { name: 'Almost Full', value: bins.filter((b) => b.status === 'almost-full').length, color: '#ea580c' },
    { name: 'Full', value: bins.filter((b) => b.status === 'full').length, color: '#dc2626' },
  ]

  const complaints = area === 'all' ? db.complaints : db.complaints.filter((c) => c.address.includes(area))
  const buckets = Math.min(weekly.length, 12)
  const complaintTrend = Array.from({ length: buckets }, (_, i) => {
    const received = Math.round(6 + seededNoise(i * 7 + days) * 10) * (area === 'all' ? 1 : 0.3)
    return {
      label: weekly[weekly.length - buckets + i]?.label.replace('Wk of ', '') ?? `W${i + 1}`,
      received: Math.round(received),
      resolved: Math.round(received * (0.7 + seededNoise(i + 3) * 0.25)),
    }
  })
  // Fold real complaints from the live dataset into the most recent bucket.
  if (complaintTrend.length) {
    const last = complaintTrend[complaintTrend.length - 1]
    last.received += complaints.length
    last.resolved += complaints.filter((c) => c.status === 'resolved').length
  }

  const vehiclePerformance = db.vehicles.map((v, i) => {
    const route = db.routes.find((r) => r.vehicleId === v.id)
    const stopsDone = route?.orderedStops.filter((s) => s.collected).length ?? 0
    return {
      vehicle: v.vehicleName.replace('Truck ', ''),
      trips: v.status === 'maintenance' ? 0 : Math.round(days * (1.6 + seededNoise(i * 11) * 0.8)) + stopsDone,
      tonnes: v.status === 'maintenance' ? 0 : Math.round(days * (2.8 + seededNoise(i * 5) * 1.4) * 10) / 10,
    }
  })

  const totalCollected = daily.reduce((s, d) => s + d.collected, 0)
  const totalGenerated = daily.reduce((s, d) => s + d.generated, 0)
  const avgEfficiency = Math.round((totalCollected / totalGenerated) * 1000) / 10
  const firstWeek = daily.slice(0, 7)
  const lastWeek = daily.slice(-7)
  const effStart = firstWeek.reduce((s, d) => s + d.efficiency, 0) / firstWeek.length
  const effEnd = lastWeek.reduce((s, d) => s + d.efficiency, 0) / lastWeek.length

  const routeKmSaved = db.routes.reduce((s, r) => s + (r.baselineDistance - r.estimatedDistance), 0)
  const distanceReducedKm = Math.round(days * 14.5 * (areas.length / AREAS.length) + routeKmSaved)
  const fuelSavedL = Math.round(distanceReducedKm * 0.38)

  return {
    daily,
    weekly,
    areaWise,
    fillDistribution,
    complaintTrend,
    vehiclePerformance,
    summary: {
      totalCollectedT: Math.round(totalCollected / 100) / 10,
      avgDailyKg: Math.round(totalCollected / days),
      avgEfficiency,
      complaintsReceived: complaintTrend.reduce((s, c) => s + c.received, 0),
      complaintsResolved: complaintTrend.reduce((s, c) => s + c.resolved, 0),
    },
    impact: {
      fuelSavedL,
      distanceReducedKm,
      efficiencyGain: Math.round((effEnd - effStart) * 10) / 10,
      co2AvoidedKg: Math.round(fuelSavedL * 2.68),
      totalCollectedT: Math.round(totalCollected / 100) / 10,
    },
  }
}

export type AnalyticsData = ReturnType<typeof buildAnalytics>
