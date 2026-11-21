import { DEFAULT_WASTE_CATEGORIES } from './constants'
import { applyFillLevel, reconcileAlerts } from './logic'
import type { Alert, Complaint, Database, Settings, SmartBin, Vehicle } from './types'

const AREA_ANCHORS: Record<string, { lat: number; lng: number; streets: string[] }> = {
  'Central District': { lat: 12.9716, lng: 77.5946, streets: ['Civic Plaza', 'Market Square', 'Library Rd', 'Unity Circle', 'Main St'] },
  Riverside: { lat: 12.9552, lng: 77.6245, streets: ['Riverfront Walk', 'Willow Lane', 'Bridge St', 'Ferry Point', 'Mill Rd'] },
  'North Hills': { lat: 13.0035, lng: 77.5891, streets: ['Hilltop Ave', 'Cedar Park', 'Summit Rd', 'Pine Crescent', 'Lookout Way'] },
  'Tech Park': { lat: 12.9784, lng: 77.6408, streets: ['Innovation Blvd', 'Silicon Ave', 'Data Dr', 'Campus Loop', 'Fiber St'] },
  'Old Town': { lat: 12.9592, lng: 77.5712, streets: ['Heritage Rd', 'Clock Tower Sq', 'Bazaar Lane', 'Temple St', 'Fort Rd'] },
  'Harbor View': { lat: 12.9361, lng: 77.6101, streets: ['Dockside Rd', 'Marina Way', 'Lighthouse Ln', 'Pier St', 'Bay Crescent'] },
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const FILL_SEED = [12, 34, 67, 88, 45, 92, 23, 56, 71, 100, 8, 39, 63, 84, 27, 51, 95, 18, 74, 42, 30, 58, 81, 15, 66, 47, 20, 76, 36, 53]

export function createSeedDatabase(): Database {
  const rand = seeded(42)
  const now = Date.now()
  const settings = defaultSettings()
  let bins: SmartBin[] = []
  let alerts: Alert[] = []
  let i = 0

  for (const [area, anchor] of Object.entries(AREA_ANCHORS)) {
    anchor.streets.forEach((street) => {
      const id = `BIN-${String(101 + i).padStart(4, '0')}`
      const base: SmartBin = {
        id,
        latitude: +(anchor.lat + (rand() - 0.5) * 0.018).toFixed(6),
        longitude: +(anchor.lng + (rand() - 0.5) * 0.018).toFixed(6),
        location: street,
        area,
        fillLevel: 0,
        wasteCategory: DEFAULT_WASTE_CATEGORIES[i % DEFAULT_WASTE_CATEGORIES.length],
        status: 'normal',
        lastUpdated: new Date(now).toISOString(),
        alertTier: 0,
      }
      const ts = new Date(now - Math.round(rand() * 90) * 60000).toISOString()
      const { bin, alert } = applyFillLevel(base, FILL_SEED[i], settings.thresholds, ts)
      bins.push(bin)
      alerts = reconcileAlerts(alerts, bin, alert, ts)
      i++
    })
  }
  alerts = alerts.map((a, idx) => ({ ...a, isRead: idx % 3 === 2 }))
  bins = bins.sort((a, b) => a.id.localeCompare(b.id))

  return {
    version: 1,
    bins,
    alerts: alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    vehicles: seedVehicles(),
    routes: [],
    complaints: seedComplaints(now),
    settings,
    collectedTodayKg: 4820,
  }
}

export function defaultSettings(): Settings {
  return {
    adminName: 'Ananya Rao',
    adminEmail: 'ananya.rao@greenhaven.gov',
    department: 'Department of Solid Waste Management',
    thresholds: { warning: 80, high: 90, critical: 100 },
    wasteCategories: [...DEFAULT_WASTE_CATEGORIES],
    notifications: { inApp: true, criticalOnly: false, complaintUpdates: true, dailyDigest: false },
    autoSimulate: false,
    simulationIntervalSec: 8,
    theme: 'light',
  }
}

function seedVehicles(): Vehicle[] {
  const depots = [
    { name: 'Truck GH-01', driver: 'Suresh P.', lat: 12.9842, lng: 77.5772 },
    { name: 'Truck GH-02', driver: 'Kavya N.', lat: 12.9481, lng: 77.6312 },
    { name: 'Truck GH-03', driver: 'Imran S.', lat: 13.0092, lng: 77.6105 },
    { name: 'Truck GH-04', driver: 'Diya M.', lat: 12.9402, lng: 77.5838 },
    { name: 'Truck GH-05', driver: 'Joseph T.', lat: 12.9701, lng: 77.6517 },
  ]
  return depots.map((d, i) => ({
    id: `VEH-${String(i + 1).padStart(2, '0')}`,
    vehicleName: d.name,
    driver: d.driver,
    latitude: d.lat,
    longitude: d.lng,
    depotLatitude: d.lat,
    depotLongitude: d.lng,
    status: i === 3 ? 'maintenance' : 'available',
    capacityKg: 6000,
    assignedRoute: null,
  }))
}

function seedComplaints(now: number): Complaint[] {
  const h = (hours: number) => new Date(now - hours * 3600000).toISOString()
  const raw: Omit<Complaint, 'history'>[] = [
    {
      id: 'CMP-24811',
      citizenName: 'Priya Sharma',
      contact: 'priya.s@mail.com',
      category: 'Overflowing Garbage Bin',
      description: 'The bin near the bus stop has been overflowing since yesterday evening. Waste is spilling onto the footpath.',
      image: null,
      latitude: 12.9731,
      longitude: 77.5968,
      address: 'Market Square, Central District',
      status: 'submitted',
      assignedTo: null,
      createdAt: h(2),
    },
    {
      id: 'CMP-24796',
      citizenName: 'Rahul Menon',
      contact: '+91 98450 11223',
      category: 'Illegal Garbage Dumping',
      description: 'Construction debris dumped on the empty plot beside the riverside walking path.',
      image: null,
      latitude: 12.9538,
      longitude: 77.6271,
      address: 'Riverfront Walk, Riverside',
      status: 'under-review',
      assignedTo: null,
      createdAt: h(9),
    },
    {
      id: 'CMP-24780',
      citizenName: 'Sneha Pillai',
      contact: 'sneha.p@mail.com',
      category: 'Irregular Garbage Collection',
      description: 'Collection truck has skipped our street three days in a row.',
      image: null,
      latitude: 13.0051,
      longitude: 77.5862,
      address: 'Cedar Park, North Hills',
      status: 'assigned',
      assignedTo: 'Ravi Kumar – Sanitation Crew A',
      createdAt: h(20),
    },
    {
      id: 'CMP-24762',
      citizenName: 'Aditya Rao',
      contact: '+91 99001 55678',
      category: 'Damaged Garbage Bin',
      description: 'Lid of the recycling bin is broken and stray animals are scattering waste.',
      image: null,
      latitude: 12.9603,
      longitude: 77.5699,
      address: 'Clock Tower Sq, Old Town',
      status: 'resolved',
      assignedTo: 'Fatima Khan – Bin Maintenance',
      createdAt: h(46),
    },
    {
      id: 'CMP-24755',
      citizenName: 'Neha Gupta',
      contact: 'neha.g@mail.com',
      category: 'Uncollected Waste',
      description: 'Bags of household waste left at the marina parking lot entrance.',
      image: null,
      latitude: 12.9374,
      longitude: 77.6122,
      address: 'Marina Way, Harbor View',
      status: 'assigned',
      assignedTo: 'Meera Iyer – Sanitation Crew B',
      createdAt: h(30),
    },
    {
      id: 'CMP-24741',
      citizenName: 'Vikram Joshi',
      contact: '+91 90080 33445',
      category: 'Overflowing Garbage Bin',
      description: 'Organic waste bin outside the office complex is full and smells.',
      image: null,
      latitude: 12.9797,
      longitude: 77.6389,
      address: 'Innovation Blvd, Tech Park',
      status: 'resolved',
      assignedTo: 'Ravi Kumar – Sanitation Crew A',
      createdAt: h(70),
    },
  ]
  return raw.map((c) => {
    const history: Complaint['history'] = [{ status: 'submitted', at: c.createdAt }]
    const order = ['under-review', 'assigned', 'resolved'] as const
    const stop = order.indexOf(c.status as (typeof order)[number])
    for (let i = 0; i <= stop; i++) {
      history.push({ status: order[i], at: new Date(new Date(c.createdAt).getTime() + (i + 1) * 3 * 3600000).toISOString() })
    }
    return { ...c, history }
  })
}
