export type WasteCategory = 'General' | 'Recyclable' | 'Organic' | 'Hazardous' | 'E-Waste'

export type BinStatus = 'normal' | 'moderate' | 'almost-full' | 'full'

export interface Area {
  id: string
  name: string
  lat: number
  lng: number
  population: number
}

export interface Bin {
  id: string
  location: string
  area: string
  lat: number
  lng: number
  fillLevel: number
  category: WasteCategory
  capacityLiters: number
  lastUpdated: string
  lastCollected: string
  sensorBattery: number
  installedOn: string
}

export type AlertSeverity = 'warning' | 'high' | 'critical'
export type AlertStatus = 'unread' | 'read' | 'resolved'

export interface Alert {
  id: string
  binId: string
  location: string
  area: string
  fillLevel: number
  severity: AlertSeverity
  status: AlertStatus
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolutionNote?: string
}

export type ActivityType =
  | 'alert-created'
  | 'alert-escalated'
  | 'alert-resolved'
  | 'bin-reset'
  | 'complaint-submitted'
  | 'complaint-updated'
  | 'route-optimized'
  | 'route-progress'

export interface ActivityEntry {
  id: string
  type: ActivityType
  title: string
  message: string
  createdAt: string
  channel: 'in-app'
}

export type VehicleStatus = 'available' | 'on-route' | 'maintenance'

export interface Vehicle {
  id: string
  name: string
  plate: string
  driver: string
  capacityKg: number
  loadPct: number
  status: VehicleStatus
  lat: number
  lng: number
  collectedTodayKg: number
  tripsToday: number
}

export type ComplaintCategory =
  | 'Overflowing garbage bin'
  | 'Irregular garbage collection'
  | 'Illegal dumping'
  | 'Damaged garbage bin'
  | 'Other'

export type ComplaintStatus = 'Submitted' | 'Under Review' | 'Assigned' | 'Resolved'

export type LocationSource = 'pin' | 'search' | 'gps' | 'area'

export interface PickedLocation {
  lat: number
  lng: number
  address?: string
  source: Exclude<LocationSource, 'area'>
}

export interface ComplaintHistoryEntry {
  status: ComplaintStatus
  at: string
  note?: string
}

export interface Complaint {
  id: string
  name: string
  contact: string
  category: ComplaintCategory
  description: string
  area: string
  address: string
  lat: number
  lng: number
  /** How the coordinates were captured. 'area' means approximated from the district centre. */
  locationSource?: LocationSource
  image?: string
  status: ComplaintStatus
  assignedTo?: string
  createdAt: string
  updatedAt: string
  history: ComplaintHistoryEntry[]
}

export interface Worker {
  id: string
  name: string
  role: string
  area: string
}

export type RouteStatus = 'pending' | 'in-progress' | 'completed'

export interface CollectionRoute {
  id: string
  vehicleId: string
  color: string
  stops: string[]
  completedStops: number
  distanceKm: number
  durationMin: number
  status: RouteStatus
}

export interface RoutePlan {
  id: string
  generatedAt: string
  routes: CollectionRoute[]
  totalDistanceKm: number
  baselineDistanceKm: number
  timeSavedMin: number
  isSimulated: true
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  profile: {
    name: string
    email: string
    phone: string
    role: string
    department: string
  }
  notifications: {
    inApp: boolean
    toasts: boolean
    criticalOnly: boolean
    dailyDigest: boolean
  }
  thresholds: {
    warning: number
    high: number
    critical: number
    collection: number
  }
  system: {
    autoSimulate: boolean
    simulationIntervalSec: number
    mapAutoFit: boolean
  }
  theme: ThemePreference
}

export type Role = 'admin' | 'citizen'

export interface AppState {
  version: number
  bins: Bin[]
  alerts: Alert[]
  activity: ActivityEntry[]
  vehicles: Vehicle[]
  complaints: Complaint[]
  workers: Worker[]
  routePlan: RoutePlan | null
  settings: Settings
}
