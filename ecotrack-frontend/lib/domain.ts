import type {
  AlertSeverity,
  BinStatus,
  ComplaintCategory,
  ComplaintStatus,
  Settings,
  VehicleStatus,
  WasteCategory,
} from './types'

export const CITY_NAME = 'Port Verdana'

export const WASTE_CATEGORIES: WasteCategory[] = [
  'General',
  'Recyclable',
  'Organic',
  'Hazardous',
  'E-Waste',
]

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'Overflowing garbage bin',
  'Irregular garbage collection',
  'Illegal dumping',
  'Damaged garbage bin',
  'Other',
]

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'Resolved',
]

export const BIN_STATUSES: BinStatus[] = ['normal', 'moderate', 'almost-full', 'full']

export function getBinStatus(fillLevel: number): BinStatus {
  if (fillLevel >= 100) return 'full'
  if (fillLevel >= 80) return 'almost-full'
  if (fillLevel >= 50) return 'moderate'
  return 'normal'
}

export const BIN_STATUS_META: Record<
  BinStatus,
  { label: string; range: string; color: string; text: string; bg: string; hex: string }
> = {
  normal: {
    label: 'Normal',
    range: '0–49%',
    color: 'bg-success',
    text: 'text-success',
    bg: 'bg-success/12',
    hex: '#22a06b',
  },
  moderate: {
    label: 'Moderate',
    range: '50–79%',
    color: 'bg-moderate',
    text: 'text-[oklch(0.55_0.12_80)] dark:text-moderate',
    bg: 'bg-moderate/20',
    hex: '#e2b203',
  },
  'almost-full': {
    label: 'Almost Full',
    range: '80–99%',
    color: 'bg-warning',
    text: 'text-warning',
    bg: 'bg-warning/12',
    hex: '#f07a1d',
  },
  full: {
    label: 'Full',
    range: '100%',
    color: 'bg-critical',
    text: 'text-critical',
    bg: 'bg-critical/12',
    hex: '#dc3b2f',
  },
}

export function getAlertSeverity(
  fillLevel: number,
  thresholds: Settings['thresholds'],
): AlertSeverity | null {
  if (fillLevel >= thresholds.critical) return 'critical'
  if (fillLevel >= thresholds.high) return 'high'
  if (fillLevel >= thresholds.warning) return 'warning'
  return null
}

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  warning: 1,
  high: 2,
  critical: 3,
}

export const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; text: string; bg: string; dot: string }
> = {
  warning: { label: 'Warning', text: 'text-warning', bg: 'bg-warning/12', dot: 'bg-warning' },
  high: {
    label: 'High Priority',
    text: 'text-[oklch(0.6_0.2_38)]',
    bg: 'bg-[oklch(0.6_0.2_38)]/12',
    dot: 'bg-[oklch(0.6_0.2_38)]',
  },
  critical: { label: 'Critical', text: 'text-critical', bg: 'bg-critical/12', dot: 'bg-critical' },
}

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, { text: string; bg: string; hex: string }> = {
  Submitted: { text: 'text-chart-5', bg: 'bg-chart-5/12', hex: '#dc2626' },
  'Under Review': { text: 'text-warning', bg: 'bg-warning/12', hex: '#ea7a12' },
  Assigned: { text: 'text-primary', bg: 'bg-primary/12', hex: '#2563eb' },
  Resolved: { text: 'text-success', bg: 'bg-success/12', hex: '#16a34a' },
}

/** Categories that refer to a specific physical spot and therefore need a map pin. */
export const LOCATION_REQUIRED_CATEGORIES: ComplaintCategory[] = [
  'Overflowing garbage bin',
  'Illegal dumping',
  'Damaged garbage bin',
]

export function requiresLocation(category: ComplaintCategory | '') {
  return !!category && LOCATION_REQUIRED_CATEGORIES.includes(category)
}

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function nearestArea<T extends { lat: number; lng: number }>(areas: T[], lat: number, lng: number): T {
  return areas.reduce((best, a) =>
    (a.lat - lat) ** 2 + (a.lng - lng) ** 2 < (best.lat - lat) ** 2 + (best.lng - lng) ** 2 ? a : best,
  )
}

export const VEHICLE_STATUS_META: Record<VehicleStatus, { label: string; text: string; bg: string }> = {
  available: { label: 'Available', text: 'text-success', bg: 'bg-success/12' },
  'on-route': { label: 'On Route', text: 'text-primary', bg: 'bg-primary/12' },
  maintenance: { label: 'Maintenance', text: 'text-muted-foreground', bg: 'bg-muted' },
}

export const ROUTE_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16']

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now()
    .toString(36)
    .slice(-3)
    .toUpperCase()}`
}

export function generateComplaintId(existing: string[]) {
  let id = ''
  do {
    id = `CMP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
  } while (existing.includes(id))
  return id
}

export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
