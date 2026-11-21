import { AREAS, mulberry32 } from './mock-data'

export interface DailyStat {
  date: string
  label: string
  general: number
  recyclable: number
  organic: number
  total: number
  collections: number
  complaintsReceived: number
  complaintsResolved: number
  efficiency: number
  byArea: Record<string, number>
}

/** Simulated historical telemetry. Replace with `GET /api/analytics?range=` when a backend exists. */
export function getDailyHistory(days: number, now = Date.now()): DailyStat[] {
  const rand = mulberry32(777)
  const all: DailyStat[] = []
  const totalDays = 120
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const weekday = d.getDay()
    const weekend = weekday === 0 || weekday === 6
    const trend = 1 + (totalDays - i) / 900
    const base = (weekend ? 128 : 112) * trend
    const general = +(base * 0.48 + rand() * 9).toFixed(1)
    const recyclable = +(base * 0.27 + rand() * 6).toFixed(1)
    const organic = +(base * 0.25 + rand() * 7).toFixed(1)
    const total = +(general + recyclable + organic).toFixed(1)
    const received = Math.round(8 + rand() * 10 + (weekend ? 4 : 0))
    const resolved = Math.max(0, Math.round(received * (0.7 + rand() * 0.28)))
    const byArea: Record<string, number> = {}
    AREAS.forEach((a, idx) => {
      byArea[a.name] = +((total * a.population) / 490000 * (0.9 + rand() * 0.2) + idx * 0.2).toFixed(1)
    })
    all.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      general,
      recyclable,
      organic,
      total,
      collections: Math.round(160 + rand() * 50 + (weekend ? 25 : 0)),
      complaintsReceived: received,
      complaintsResolved: resolved,
      efficiency: +(84 + rand() * 12 + (totalDays - i) / 40).toFixed(1),
      byArea,
    })
  }
  return all.slice(-days)
}

export function aggregate(stats: DailyStat[], size: number, labeler: (s: DailyStat, i: number) => string) {
  const out: { label: string; total: number; general: number; recyclable: number; organic: number }[] = []
  for (let i = 0; i < stats.length; i += size) {
    const chunk = stats.slice(i, i + size)
    out.push({
      label: labeler(chunk[0], out.length),
      total: +chunk.reduce((s, c) => s + c.total, 0).toFixed(1),
      general: +chunk.reduce((s, c) => s + c.general, 0).toFixed(1),
      recyclable: +chunk.reduce((s, c) => s + c.recyclable, 0).toFixed(1),
      organic: +chunk.reduce((s, c) => s + c.organic, 0).toFixed(1),
    })
  }
  return out
}

export function getMonthlyStats(now = Date.now()) {
  const all = getDailyHistory(120, now)
  const map = new Map<string, { label: string; total: number; general: number; recyclable: number; organic: number }>()
  all.forEach((d) => {
    const key = d.date.slice(0, 7)
    const label = new Date(d.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    const cur = map.get(key) ?? { label, total: 0, general: 0, recyclable: 0, organic: 0 }
    cur.total += d.total
    cur.general += d.general
    cur.recyclable += d.recyclable
    cur.organic += d.organic
    map.set(key, cur)
  })
  return [...map.values()].map((m) => ({
    ...m,
    total: +m.total.toFixed(0),
    general: +m.general.toFixed(0),
    recyclable: +m.recyclable.toFixed(0),
    organic: +m.organic.toFixed(0),
  }))
}

export const HOURLY_ACTIVITY = [
  { hour: '05:00', collections: 6, tons: 2.1 },
  { hour: '06:00', collections: 18, tons: 6.4 },
  { hour: '07:00', collections: 27, tons: 9.8 },
  { hour: '08:00', collections: 31, tons: 11.2 },
  { hour: '09:00', collections: 24, tons: 8.6 },
  { hour: '10:00', collections: 16, tons: 5.9 },
  { hour: '11:00', collections: 12, tons: 4.3 },
  { hour: '12:00', collections: 9, tons: 3.2 },
  { hour: '13:00', collections: 11, tons: 3.9 },
  { hour: '14:00', collections: 14, tons: 5.1 },
  { hour: '15:00', collections: 17, tons: 6.0 },
  { hour: '16:00', collections: 13, tons: 4.6 },
]
