/**
 * Centralized data-access layer. Every function returns a Promise so the mock
 * implementations (backed by localStorage) can be swapped for HTTP calls to a
 * real backend without touching UI components. Set NEXT_PUBLIC_ECOTRACK_API_URL
 * and replace the bodies below with `request(...)` calls when the backend is ready.
 */
import { STORAGE_KEY } from './constants'
import { applyFillLevel, clampFill, makeId, optimizeRoutes, reconcileAlerts } from './logic'
import { createSeedDatabase } from './mock-data'
import { buildAnalytics, type AnalyticsQuery } from './analytics'
import type {
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  Database,
  Settings,
} from './types'

export const API_BASE_URL = process.env.NEXT_PUBLIC_ECOTRACK_API_URL ?? ''

const LATENCY_MS = 180
const delay = <T,>(value: T, ms = LATENCY_MS) => new Promise<T>((r) => setTimeout(() => r(value), ms))

function load(): Database {
  if (typeof window === 'undefined') return createSeedDatabase()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Database
      if (parsed.version === 1) return parsed
    }
  } catch {
    // Corrupt storage falls through to a fresh seed.
  }
  const seed = createSeedDatabase()
  save(seed)
  return seed
}

function save(db: Database) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    throw new Error('Unable to save data locally. Storage may be full — try removing large image attachments.')
  }
}

function mutate(fn: (db: Database) => Database): Promise<Database> {
  const next = fn(load())
  save(next)
  return delay(next)
}

/* ---------------- Database snapshot ---------------- */

export function fetchDatabase() {
  return delay(load())
}

export function resetSimulation() {
  return mutate(() => createSeedDatabase())
}

/* ---------------- Smart bins ---------------- */

export function fetchBins() {
  return delay(load().bins)
}

export function updateBinFillLevels(updates: { id: string; fillLevel: number }[]) {
  return mutate((db) => {
    const now = new Date().toISOString()
    let alerts = db.alerts
    const byId = new Map(updates.map((u) => [u.id, u.fillLevel]))
    const bins = db.bins.map((bin) => {
      const level = byId.get(bin.id)
      if (level === undefined) return bin
      const { bin: next, alert } = applyFillLevel(bin, level, db.settings.thresholds, now)
      alerts = reconcileAlerts(alerts, next, alert, now)
      return next
    })
    return { ...db, bins, alerts }
  })
}

export function simulateBinActivity() {
  const db = load()
  const updates = db.bins
    .filter(() => Math.random() < 0.6)
    .map((b) => ({ id: b.id, fillLevel: clampFill(b.fillLevel + 3 + Math.random() * 14) }))
  return updateBinFillLevels(updates)
}

/* ---------------- Alerts ---------------- */

export function fetchAlerts() {
  return delay(load().alerts)
}

export function markAlertsRead(ids: string[] | 'all') {
  return mutate((db) => ({
    ...db,
    alerts: db.alerts.map((a) => (ids === 'all' || ids.includes(a.id) ? { ...a, isRead: true } : a)),
  }))
}

export function resolveAlert(id: string) {
  return mutate((db) => ({
    ...db,
    alerts: db.alerts.map((a) =>
      a.id === id ? { ...a, isResolved: true, isRead: true, resolvedAt: new Date().toISOString(), note: 'Resolved by administrator' } : a,
    ),
  }))
}

/* ---------------- Routes ---------------- */

export function generateCollectionRoutes() {
  return mutate((db) => {
    const routes = optimizeRoutes(db.bins, db.vehicles, db.settings.thresholds)
    const assigned = new Map(routes.map((r) => [r.vehicleId, r.id]))
    const vehicles = db.vehicles.map((v) => {
      if (v.status === 'maintenance') return v
      const routeId = assigned.get(v.id) ?? null
      return {
        ...v,
        latitude: v.depotLatitude,
        longitude: v.depotLongitude,
        assignedRoute: routeId,
        status: routeId ? ('on-route' as const) : ('available' as const),
      }
    })
    return { ...db, routes, vehicles }
  })
}

/** Simulates the vehicle reaching its next stop and emptying that bin. */
export function advanceRoute(routeId: string) {
  return mutate((db) => {
    const route = db.routes.find((r) => r.id === routeId)
    if (!route || route.status === 'completed') return db
    const idx = route.orderedStops.findIndex((s) => !s.collected)
    if (idx === -1) return db
    const stop = route.orderedStops[idx]
    const now = new Date().toISOString()

    const orderedStops = route.orderedStops.map((s, i) => (i === idx ? { ...s, collected: true } : s))
    const done = orderedStops.every((s) => s.collected)
    const routes = db.routes.map((r) =>
      r.id === routeId ? { ...r, orderedStops, status: done ? ('completed' as const) : ('in-progress' as const) } : r,
    )

    let alerts = db.alerts
    let collectedKg = 0
    const bins = db.bins.map((b) => {
      if (b.id !== stop.binId) return b
      collectedKg = Math.round(b.fillLevel * 2.4)
      const { bin } = applyFillLevel(b, Math.round(Math.random() * 6), db.settings.thresholds, now)
      alerts = reconcileAlerts(alerts, bin, null, now)
      return bin
    })

    const vehicles = db.vehicles.map((v) => {
      if (v.id !== route.vehicleId) return v
      if (done) return { ...v, latitude: v.depotLatitude, longitude: v.depotLongitude, status: 'available' as const, assignedRoute: null }
      return { ...v, latitude: stop.latitude, longitude: stop.longitude }
    })

    return { ...db, routes, bins, alerts, vehicles, collectedTodayKg: db.collectedTodayKg + collectedKg }
  })
}

export function clearRoutes() {
  return mutate((db) => ({
    ...db,
    routes: [],
    vehicles: db.vehicles.map((v) =>
      v.status === 'maintenance'
        ? v
        : { ...v, status: 'available' as const, assignedRoute: null, latitude: v.depotLatitude, longitude: v.depotLongitude },
    ),
  }))
}

/* ---------------- Complaints ---------------- */

export interface ComplaintInput {
  citizenName: string
  contact: string
  category: ComplaintCategory
  description: string
  image: string | null
  latitude: number
  longitude: number
  address: string
}

export async function submitComplaint(input: ComplaintInput): Promise<{ db: Database; complaint: Complaint }> {
  const now = new Date().toISOString()
  const complaint: Complaint = {
    ...input,
    id: `CMP-${String(Math.floor(10000 + Math.random() * 89999))}`,
    status: 'submitted',
    assignedTo: null,
    createdAt: now,
    history: [{ status: 'submitted', at: now }],
  }
  const db = await mutate((d) => ({ ...d, complaints: [complaint, ...d.complaints] }))
  return { db, complaint }
}

export function fetchComplaints() {
  return delay(load().complaints)
}

export function fetchComplaintById(id: string) {
  const found = load().complaints.find((c) => c.id.toLowerCase() === id.trim().toLowerCase()) ?? null
  return delay(found, 400)
}

export function updateComplaint(id: string, patch: { status?: ComplaintStatus; assignedTo?: string | null; note?: string }) {
  return mutate((db) => ({
    ...db,
    complaints: db.complaints.map((c) => {
      if (c.id !== id) return c
      const status = patch.status ?? (patch.assignedTo ? 'assigned' : c.status)
      const history = status !== c.status ? [...c.history, { status, at: new Date().toISOString(), note: patch.note }] : c.history
      return { ...c, status, assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : c.assignedTo, history }
    }),
  }))
}

/* ---------------- Settings ---------------- */

export function updateSettings(patch: Partial<Settings>) {
  return mutate((db) => ({ ...db, settings: { ...db.settings, ...patch } }))
}

/* ---------------- Analytics ---------------- */

export function fetchAnalytics(query: AnalyticsQuery) {
  return delay(buildAnalytics(load(), query), 250)
}

export { makeId }
