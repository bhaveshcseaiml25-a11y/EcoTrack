'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { clamp, getAlertSeverity, SEVERITY_META, SEVERITY_RANK, uid } from './domain'
import { createSeedState, STATE_VERSION } from './mock-data'
import type {
  ActivityEntry,
  Alert,
  AppState,
  Complaint,
  ComplaintStatus,
  RoutePlan,
  Settings,
} from './types'

const STORAGE_KEY = 'ecotrack:demo-state'

type FillChange = { binId: string; fillLevel: number; reason?: 'sensor' | 'collection' | 'manual' }

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'apply-fill'; changes: FillChange[] }
  | { type: 'mark-alert-read'; id: string }
  | { type: 'mark-all-alerts-read' }
  | { type: 'resolve-alert'; id: string; note?: string }
  | { type: 'submit-complaint'; complaint: Complaint }
  | {
      type: 'update-complaint'
      id: string
      status?: ComplaintStatus
      assignedTo?: string
      note?: string
    }
  | { type: 'set-route-plan'; plan: RoutePlan | null }
  | { type: 'start-route'; routeId: string }
  | { type: 'collect-next-stop'; routeId: string }
  | { type: 'update-settings'; settings: Settings }
  | { type: 'reset-demo' }

function activity(type: ActivityEntry['type'], title: string, message: string): ActivityEntry {
  return { id: uid('ACT'), type, title, message, createdAt: new Date().toISOString(), channel: 'in-app' }
}

function applyFillChanges(state: AppState, changes: FillChange[]): AppState {
  const now = new Date().toISOString()
  let alerts = [...state.alerts]
  const log: ActivityEntry[] = []

  const bins = state.bins.map((bin) => {
    const change = changes.find((c) => c.binId === bin.id)
    if (!change) return bin
    const fillLevel = Math.round(clamp(change.fillLevel, 0, 100))
    const severity = getAlertSeverity(fillLevel, state.settings.thresholds)
    const activeIdx = alerts.findIndex((a) => a.binId === bin.id && a.status !== 'resolved')
    const active = activeIdx >= 0 ? alerts[activeIdx] : null

    if (severity && !active) {
      const alert: Alert = {
        id: uid('ALT'),
        binId: bin.id,
        location: bin.location,
        area: bin.area,
        fillLevel,
        severity,
        status: 'unread',
        createdAt: now,
        updatedAt: now,
      }
      alerts = [alert, ...alerts]
      log.push(
        activity(
          'alert-created',
          `${SEVERITY_META[severity].label} alert · ${bin.id}`,
          `${bin.location}, ${bin.area} reached ${fillLevel}% fill level.`,
        ),
      )
    } else if (severity && active) {
      const escalated = SEVERITY_RANK[severity] > SEVERITY_RANK[active.severity]
      alerts[activeIdx] = {
        ...active,
        fillLevel,
        severity: escalated ? severity : active.severity,
        status: escalated ? 'unread' : active.status,
        updatedAt: escalated ? now : active.updatedAt,
      }
      if (escalated) {
        log.push(
          activity(
            'alert-escalated',
            `Escalated to ${SEVERITY_META[severity].label} · ${bin.id}`,
            `${bin.location}, ${bin.area} is now at ${fillLevel}%.`,
          ),
        )
      }
    } else if (!severity && active) {
      alerts[activeIdx] = {
        ...active,
        fillLevel,
        status: 'resolved',
        resolvedAt: now,
        updatedAt: now,
        resolutionNote:
          change.reason === 'collection' ? 'Auto-resolved: bin collected.' : 'Auto-resolved: fill level dropped below threshold.',
      }
      log.push(activity('alert-resolved', `Alert auto-resolved · ${bin.id}`, `${bin.location} is back to ${fillLevel}%.`))
    }

    if (change.reason === 'collection' || change.reason === 'manual') {
      if (fillLevel === 0) {
        log.push(activity('bin-reset', `Bin emptied · ${bin.id}`, `${bin.location}, ${bin.area} was reset to 0%.`))
      }
    }

    return {
      ...bin,
      fillLevel,
      lastUpdated: now,
      lastCollected: fillLevel === 0 ? now : bin.lastCollected,
    }
  })

  return { ...state, bins, alerts, activity: [...log.reverse(), ...state.activity].slice(0, 300) }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'apply-fill':
      return applyFillChanges(state, action.changes)
    case 'mark-alert-read':
      return {
        ...state,
        alerts: state.alerts.map((a) => (a.id === action.id && a.status === 'unread' ? { ...a, status: 'read' } : a)),
      }
    case 'mark-all-alerts-read':
      return {
        ...state,
        alerts: state.alerts.map((a) => (a.status === 'unread' ? { ...a, status: 'read' } : a)),
      }
    case 'resolve-alert': {
      const now = new Date().toISOString()
      const alert = state.alerts.find((a) => a.id === action.id)
      if (!alert) return state
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.id
            ? { ...a, status: 'resolved', resolvedAt: now, updatedAt: now, resolutionNote: action.note || 'Resolved by administrator.' }
            : a,
        ),
        activity: [
          activity('alert-resolved', `Alert resolved · ${alert.binId}`, action.note || `Marked resolved by administrator.`),
          ...state.activity,
        ],
      }
    }
    case 'submit-complaint':
      return {
        ...state,
        complaints: [action.complaint, ...state.complaints],
        activity: [
          activity(
            'complaint-submitted',
            `New complaint · ${action.complaint.id}`,
            `${action.complaint.category} reported at ${action.complaint.address}, ${action.complaint.area}.`,
          ),
          ...state.activity,
        ],
      }
    case 'update-complaint': {
      const now = new Date().toISOString()
      let changed: Complaint | null = null
      const complaints = state.complaints.map((c) => {
        if (c.id !== action.id) return c
        let status = action.status ?? c.status
        if (action.assignedTo && action.assignedTo !== c.assignedTo && status !== 'Resolved') status = 'Assigned'
        const history = [...c.history]
        if (status !== c.status || action.note) history.push({ status, at: now, note: action.note })
        changed = { ...c, status, assignedTo: action.assignedTo ?? c.assignedTo, updatedAt: now, history }
        return changed
      })
      if (!changed) return state
      const updated = changed as Complaint
      return {
        ...state,
        complaints,
        activity: [
          activity('complaint-updated', `Complaint ${updated.id} · ${updated.status}`, `Status updated for ${updated.category.toLowerCase()} at ${updated.area}.`),
          ...state.activity,
        ],
      }
    }
    case 'set-route-plan':
      return {
        ...state,
        routePlan: action.plan,
        vehicles: action.plan
          ? state.vehicles
          : state.vehicles.map((v) => (v.status === 'on-route' ? { ...v, status: 'available' } : v)),
        activity: action.plan
          ? [
              activity(
                'route-optimized',
                `Routes optimized · ${action.plan.routes.length} vehicles`,
                `${action.plan.routes.reduce((s, r) => s + r.stops.length, 0)} bins scheduled across ${action.plan.totalDistanceKm} km (simulated).`,
              ),
              ...state.activity,
            ]
          : state.activity,
      }
    case 'start-route': {
      if (!state.routePlan) return state
      const route = state.routePlan.routes.find((r) => r.id === action.routeId)
      if (!route || route.status !== 'pending') return state
      return {
        ...state,
        routePlan: {
          ...state.routePlan,
          routes: state.routePlan.routes.map((r) => (r.id === action.routeId ? { ...r, status: 'in-progress' } : r)),
        },
        vehicles: state.vehicles.map((v) => (v.id === route.vehicleId ? { ...v, status: 'on-route' } : v)),
      }
    }
    case 'collect-next-stop': {
      if (!state.routePlan) return state
      const route = state.routePlan.routes.find((r) => r.id === action.routeId)
      if (!route || route.status === 'completed') return state
      const binId = route.stops[route.completedStops]
      const bin = state.bins.find((b) => b.id === binId)
      if (!bin) return state
      const completedStops = route.completedStops + 1
      const done = completedStops >= route.stops.length
      const collectedKg = Math.round(bin.capacityLiters * (bin.fillLevel / 100) * 0.12)
      let next = applyFillChanges(state, [{ binId, fillLevel: 0, reason: 'collection' }])
      next = {
        ...next,
        routePlan: {
          ...state.routePlan,
          routes: state.routePlan.routes.map((r) =>
            r.id === route.id ? { ...r, completedStops, status: done ? 'completed' : 'in-progress' } : r,
          ),
        },
        vehicles: next.vehicles.map((v) =>
          v.id === route.vehicleId
            ? {
                ...v,
                lat: bin.lat,
                lng: bin.lng,
                status: done ? 'available' : 'on-route',
                loadPct: done ? 0 : clamp(v.loadPct + Math.round((collectedKg / v.capacityKg) * 100), 0, 100),
                collectedTodayKg: v.collectedTodayKg + collectedKg,
                tripsToday: done ? v.tripsToday + 1 : v.tripsToday,
              }
            : v,
        ),
        activity: [
          activity(
            'route-progress',
            `Route ${route.id} · stop ${completedStops}/${route.stops.length}`,
            done ? `Route completed. Vehicle ${route.vehicleId} returning to depot.` : `${bin.id} at ${bin.location} collected.`,
          ),
          ...next.activity,
        ],
      }
      return next
    }
    case 'update-settings':
      return { ...state, settings: action.settings }
    case 'reset-demo':
      return createSeedState()
    default:
      return state
  }
}

interface StoreValue {
  state: AppState
  hydrated: boolean
  storageError: string | null
  updateFill: (binId: string, fillLevel: number, reason?: FillChange['reason']) => void
  simulateTick: () => void
  markAlertRead: (id: string) => void
  markAllAlertsRead: () => void
  resolveAlert: (id: string, note?: string) => void
  submitComplaint: (complaint: Complaint) => void
  updateComplaint: (id: string, patch: { status?: ComplaintStatus; assignedTo?: string; note?: string }) => void
  setRoutePlan: (plan: RoutePlan | null) => void
  startRoute: (routeId: string) => void
  collectNextStop: (routeId: string) => void
  updateSettings: (settings: Settings) => void
  resetDemo: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function loadState(): { state: AppState; error: string | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { state: createSeedState(), error: null }
    const parsed = JSON.parse(raw) as AppState
    if (parsed.version !== STATE_VERSION || !Array.isArray(parsed.bins)) {
      return { state: createSeedState(), error: null }
    }
    return { state: parsed, error: null }
  } catch {
    return {
      state: createSeedState(),
      error: 'Saved demo data could not be read, so fresh sample data was loaded.',
    }
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => createSeedState(0))
  const [hydrated, setHydrated] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const seenAlerts = useRef<Set<string>>(new Set())

  useEffect(() => {
    const { state: loaded, error } = loadState()
    loaded.alerts.forEach((a) => seenAlerts.current.add(`${a.id}:${a.severity}`))
    dispatch({ type: 'hydrate', state: loaded })
    setStorageError(error)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        setStorageError('Browser storage is full. Recent changes may not persist after reload.')
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [state, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const root = document.documentElement
    const apply = () => {
      const dark =
        state.settings.theme === 'dark' ||
        (state.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [state.settings.theme, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const { inApp, toasts, criticalOnly } = state.settings.notifications
    state.alerts.forEach((a) => {
      const key = `${a.id}:${a.severity}`
      if (seenAlerts.current.has(key) || a.status === 'resolved') return
      seenAlerts.current.add(key)
      if (!inApp || !toasts) return
      if (criticalOnly && a.severity !== 'critical') return
      const fn = a.severity === 'critical' ? toast.error : toast.warning
      fn(`${SEVERITY_META[a.severity].label}: ${a.binId}`, {
        description: `${a.location}, ${a.area} is at ${a.fillLevel}%. In-app notification sent to municipal team.`,
      })
    })
  }, [state.alerts, state.settings.notifications, hydrated])

  const stateRef = useRef(state)
  stateRef.current = state

  const simulateTick = useCallback(() => {
    const candidates = stateRef.current.bins.filter((b) => b.fillLevel < 100)
    const picks = [...candidates].sort(() => Math.random() - 0.5).slice(0, 3)
    dispatch({
      type: 'apply-fill',
      changes: picks.map((b) => ({ binId: b.id, fillLevel: b.fillLevel + 3 + Math.floor(Math.random() * 9), reason: 'sensor' })),
    })
  }, [])

  useEffect(() => {
    if (!hydrated || !state.settings.system.autoSimulate) return
    const id = window.setInterval(simulateTick, state.settings.system.simulationIntervalSec * 1000)
    return () => window.clearInterval(id)
  }, [hydrated, state.settings.system.autoSimulate, state.settings.system.simulationIntervalSec, simulateTick])

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      storageError,
      updateFill: (binId, fillLevel, reason = 'manual') =>
        dispatch({ type: 'apply-fill', changes: [{ binId, fillLevel, reason }] }),
      simulateTick,
      markAlertRead: (id) => dispatch({ type: 'mark-alert-read', id }),
      markAllAlertsRead: () => dispatch({ type: 'mark-all-alerts-read' }),
      resolveAlert: (id, note) => dispatch({ type: 'resolve-alert', id, note }),
      submitComplaint: (complaint) => dispatch({ type: 'submit-complaint', complaint }),
      updateComplaint: (id, patch) => dispatch({ type: 'update-complaint', id, ...patch }),
      setRoutePlan: (plan) => dispatch({ type: 'set-route-plan', plan }),
      startRoute: (routeId) => dispatch({ type: 'start-route', routeId }),
      collectNextStop: (routeId) => dispatch({ type: 'collect-next-stop', routeId }),
      updateSettings: (settings) => dispatch({ type: 'update-settings', settings }),
      resetDemo: () => {
        seenAlerts.current.clear()
        const fresh = createSeedState()
        fresh.alerts.forEach((a) => seenAlerts.current.add(`${a.id}:${a.severity}`))
        dispatch({ type: 'hydrate', state: fresh })
      },
    }),
    [state, hydrated, storageError, simulateTick],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
