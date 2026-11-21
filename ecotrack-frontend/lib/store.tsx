'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as api from './api'
import { ROLE_STORAGE_KEY } from './constants'
import type { Database, Role } from './types'

type Toast = { id: number; title: string; description?: string; tone: 'success' | 'info' | 'warning' | 'error' }

interface StoreValue {
  db: Database | null
  loading: boolean
  error: string | null
  busy: string | null
  role: Role
  setRole: (role: Role) => void
  toasts: Toast[]
  notify: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  /** Runs an API call, applies the returned database and reports errors. */
  run: (key: string, fn: () => Promise<Database>, success?: Omit<Toast, 'id'>) => Promise<Database | null>
  setDb: (db: Database) => void
  reload: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

const roleListeners = new Set<() => void>()
function subscribeRole(cb: () => void) {
  roleListeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    roleListeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}
const getRole = (): Role => (window.localStorage.getItem(ROLE_STORAGE_KEY) === 'citizen' ? 'citizen' : 'admin')

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDbState] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const prevAlertIds = useRef<Set<string> | null>(null)

  const role = useSyncExternalStore(subscribeRole, getRole, () => 'admin' as Role)
  const setRole = useCallback((r: Role) => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, r)
    roleListeners.forEach((l) => l())
  }, [])

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const notify = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++toastId.current
      setToasts((list) => [...list.slice(-3), { ...t, id }])
      setTimeout(() => dismissToast(id), 4500)
    },
    [dismissToast],
  )

  const setDb = useCallback(
    (next: Database) => {
      // Surface newly generated municipal alerts as in-app notifications.
      if (prevAlertIds.current && next.settings.notifications.inApp) {
        const fresh = next.alerts.filter((a) => !prevAlertIds.current!.has(a.id))
        const visible = next.settings.notifications.criticalOnly ? fresh.filter((a) => a.severity === 'critical') : fresh
        visible.slice(0, 3).forEach((a) =>
          notify({
            tone: a.severity === 'warning' ? 'warning' : 'error',
            title: `New ${a.severity === 'high' ? 'high priority' : a.severity} alert · ${a.binId}`,
            description: `${a.location} reached ${a.fillLevel}% (simulated municipal notification)`,
          }),
        )
      }
      prevAlertIds.current = new Set(next.alerts.map((a) => a.id))
      setDbState(next)
    },
    [notify],
  )

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .fetchDatabase()
      .then(setDb)
      .catch((e: Error) => setError(e.message || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [setDb])

  useEffect(reload, [reload])

  const run = useCallback<StoreValue['run']>(
    async (key, fn, success) => {
      setBusy(key)
      try {
        const next = await fn()
        setDb(next)
        if (success) notify(success)
        return next
      } catch (e) {
        notify({ tone: 'error', title: 'Something went wrong', description: (e as Error).message })
        return null
      } finally {
        setBusy(null)
      }
    },
    [notify, setDb],
  )

  // Optional background simulation configured in Settings.
  const autoSimulate = db?.settings.autoSimulate
  const interval = db?.settings.simulationIntervalSec ?? 8
  useEffect(() => {
    if (!autoSimulate) return
    const t = setInterval(() => {
      api.simulateBinActivity().then(setDb).catch(() => {})
    }, interval * 1000)
    return () => clearInterval(t)
  }, [autoSimulate, interval, setDb])

  const theme = db?.settings.theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const value = useMemo(
    () => ({ db, loading, error, busy, role, setRole, toasts, notify, dismissToast, run, setDb, reload }),
    [db, loading, error, busy, role, setRole, toasts, notify, dismissToast, run, setDb, reload],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
