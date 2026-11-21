import type { AlertSeverity, BinStatus, ComplaintCategory, ComplaintStatus, RouteStatus, VehicleStatus } from './types'

export const CITY_NAME = 'Greenhaven'
export const CITY_CENTER: [number, number] = [12.9716, 77.5946]

export const AREAS = ['Central District', 'Riverside', 'North Hills', 'Tech Park', 'Old Town', 'Harbor View'] as const

export const DEFAULT_WASTE_CATEGORIES = ['General', 'Recyclable', 'Organic', 'Hazardous']

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'Overflowing Garbage Bin',
  'Irregular Garbage Collection',
  'Illegal Garbage Dumping',
  'Damaged Garbage Bin',
  'Uncollected Waste',
  'Other',
]

export const MUNICIPAL_WORKERS = [
  'Ravi Kumar – Sanitation Crew A',
  'Meera Iyer – Sanitation Crew B',
  'Arjun Das – Field Inspector',
  'Fatima Khan – Bin Maintenance',
  'Leo Fernandes – Enforcement Unit',
]

export const BIN_STATUS_META: Record<BinStatus, { label: string; color: string; badge: string; bar: string }> = {
  normal: { label: 'Normal', color: '#16a34a', badge: 'bg-status-normal/15 text-status-normal', bar: 'bg-status-normal' },
  moderate: { label: 'Moderate', color: '#ca8a04', badge: 'bg-status-moderate/15 text-status-moderate', bar: 'bg-status-moderate' },
  'almost-full': { label: 'Almost Full', color: '#ea580c', badge: 'bg-status-high/15 text-status-high', bar: 'bg-status-high' },
  full: { label: 'Full', color: '#dc2626', badge: 'bg-status-critical/15 text-status-critical', bar: 'bg-status-critical' },
}

export const SEVERITY_META: Record<AlertSeverity, { label: string; color: string; badge: string }> = {
  warning: { label: 'Warning', color: '#ca8a04', badge: 'bg-status-moderate/15 text-status-moderate' },
  high: { label: 'High Priority', color: '#ea580c', badge: 'bg-status-high/15 text-status-high' },
  critical: { label: 'Critical', color: '#dc2626', badge: 'bg-status-critical/15 text-status-critical' },
}

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, { label: string; color: string; badge: string }> = {
  submitted: { label: 'Submitted', color: '#dc2626', badge: 'bg-status-critical/15 text-status-critical' },
  'under-review': { label: 'Under Review', color: '#ea580c', badge: 'bg-status-high/15 text-status-high' },
  assigned: { label: 'Assigned', color: '#2563eb', badge: 'bg-status-info/15 text-status-info' },
  resolved: { label: 'Resolved', color: '#16a34a', badge: 'bg-status-normal/15 text-status-normal' },
}

export const COMPLAINT_STATUS_ORDER: ComplaintStatus[] = ['submitted', 'under-review', 'assigned', 'resolved']

export const VEHICLE_STATUS_META: Record<VehicleStatus, { label: string; badge: string }> = {
  available: { label: 'Available', badge: 'bg-status-normal/15 text-status-normal' },
  'on-route': { label: 'On Route', badge: 'bg-status-info/15 text-status-info' },
  maintenance: { label: 'Maintenance', badge: 'bg-muted text-muted-foreground' },
}

export const ROUTE_STATUS_META: Record<RouteStatus, { label: string; badge: string }> = {
  scheduled: { label: 'Scheduled', badge: 'bg-status-moderate/15 text-status-moderate' },
  'in-progress': { label: 'In Progress', badge: 'bg-status-info/15 text-status-info' },
  completed: { label: 'Completed', badge: 'bg-status-normal/15 text-status-normal' },
}

export const ROUTE_COLORS = ['#0d9488', '#7c3aed', '#2563eb', '#db2777', '#0891b2', '#65a30d']

export const STORAGE_KEY = 'ecotrack-db-v1'
export const ROLE_STORAGE_KEY = 'ecotrack-role'
export const TRACKED_COMPLAINTS_KEY = 'ecotrack-my-complaints'
