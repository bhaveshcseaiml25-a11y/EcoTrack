export type BinStatus = 'normal' | 'moderate' | 'almost-full' | 'full'
export type WasteCategory = string
export type AlertSeverity = 'warning' | 'high' | 'critical'
export type ComplaintStatus = 'submitted' | 'under-review' | 'assigned' | 'resolved'
export type VehicleStatus = 'available' | 'on-route' | 'maintenance'
export type RouteStatus = 'scheduled' | 'in-progress' | 'completed'
export type Role = 'admin' | 'citizen'

export type ComplaintCategory =
  | 'Overflowing Garbage Bin'
  | 'Irregular Garbage Collection'
  | 'Illegal Garbage Dumping'
  | 'Damaged Garbage Bin'
  | 'Uncollected Waste'
  | 'Other'

export interface SmartBin {
  id: string
  latitude: number
  longitude: number
  location: string
  area: string
  fillLevel: number
  wasteCategory: WasteCategory
  status: BinStatus
  lastUpdated: string
  /** Highest alert tier (0 = none, 1 warning, 2 high, 3 critical) already raised since the bin was last emptied. */
  alertTier: number
}

export interface Alert {
  id: string
  binId: string
  location: string
  severity: AlertSeverity
  fillLevel: number
  timestamp: string
  isRead: boolean
  isResolved: boolean
  resolvedAt?: string
  note?: string
}

export interface Vehicle {
  id: string
  vehicleName: string
  driver: string
  latitude: number
  longitude: number
  depotLatitude: number
  depotLongitude: number
  status: VehicleStatus
  capacityKg: number
  assignedRoute: string | null
}

export interface RouteStop {
  binId: string
  location: string
  latitude: number
  longitude: number
  collected: boolean
}

export interface CollectionRoute {
  id: string
  vehicleId: string
  binIds: string[]
  orderedStops: RouteStop[]
  estimatedDistance: number
  estimatedTime: number
  baselineDistance: number
  baselineTime: number
  status: RouteStatus
  createdAt: string
}

export interface ComplaintHistoryEntry {
  status: ComplaintStatus
  at: string
  note?: string
}

export interface Complaint {
  id: string
  citizenName: string
  contact: string
  category: ComplaintCategory
  description: string
  image: string | null
  latitude: number
  longitude: number
  address: string
  status: ComplaintStatus
  assignedTo: string | null
  createdAt: string
  history: ComplaintHistoryEntry[]
}

export interface AlertThresholds {
  warning: number
  high: number
  critical: number
}

export interface Settings {
  adminName: string
  adminEmail: string
  department: string
  thresholds: AlertThresholds
  wasteCategories: string[]
  notifications: {
    inApp: boolean
    criticalOnly: boolean
    complaintUpdates: boolean
    dailyDigest: boolean
  }
  autoSimulate: boolean
  simulationIntervalSec: number
  theme: 'light' | 'dark'
}

export interface Database {
  version: number
  bins: SmartBin[]
  alerts: Alert[]
  vehicles: Vehicle[]
  routes: CollectionRoute[]
  complaints: Complaint[]
  settings: Settings
  collectedTodayKg: number
}
