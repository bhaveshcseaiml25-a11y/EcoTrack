import { getAlertSeverity, WASTE_CATEGORIES } from './domain'
import type {
  ActivityEntry,
  Alert,
  AppState,
  Area,
  Bin,
  Complaint,
  Settings,
  Vehicle,
  Worker,
} from './types'

export const STATE_VERSION = 1

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEPOT = { name: 'Central Depot', lat: 12.9716, lng: 77.5946 }

export const AREAS: Area[] = [
  { id: 'riverside', name: 'Riverside', lat: 12.9902, lng: 77.5712, population: 84000 },
  { id: 'old-town', name: 'Old Town', lat: 12.9655, lng: 77.5735, population: 112000 },
  { id: 'tech-park', name: 'Tech Park', lat: 12.9785, lng: 77.6232, population: 67000 },
  { id: 'harbor', name: 'Harbor District', lat: 12.9468, lng: 77.6058, population: 58000 },
  { id: 'green-heights', name: 'Green Heights', lat: 12.9958, lng: 77.6085, population: 73000 },
  { id: 'market', name: 'Market Square', lat: 12.9512, lng: 77.5808, population: 96000 },
]

const STREETS: Record<string, string[]> = {
  riverside: ['Willow Embankment', 'Ferry Lane', 'Heron Walk', 'Mill Road', 'Boathouse Row', 'Cedar Quay', 'Lotus Bridge'],
  'old-town': ['Clocktower Street', 'Guild Lane', 'Temple Road', 'Lantern Alley', 'Cathedral Square', 'Stonegate', 'Archive Street'],
  'tech-park': ['Innovation Drive', 'Circuit Avenue', 'Silicon Loop', 'Data Plaza', 'Quantum Road', 'Fibre Lane', 'Campus Gate 3'],
  harbor: ['Dockyard Road', 'Lighthouse Way', 'Pier 7', 'Anchor Street', 'Fishermen Wharf', 'Container Bay', 'Mariner Lane'],
  'green-heights': ['Orchard Avenue', 'Banyan Crescent', 'Hilltop Park', 'Maple Residency', 'Sunrise Boulevard', 'Fern Terrace', 'Meadow Close'],
  market: ['Bazaar Road', 'Spice Lane', 'Textile Street', 'Fruit Market', 'Bus Terminal', 'Copper Lane', 'Mandi Circle'],
}

const FILL_PATTERN = [12, 34, 58, 72, 86, 93, 100, 27, 45, 63, 81, 18, 76, 91, 8, 55, 68, 39, 84, 22, 97]

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    name: 'Ananya Rao',
    email: 'ananya.rao@portverdana.gov',
    phone: '+91 98450 12345',
    role: 'Sanitation Operations Lead',
    department: 'Municipal Solid Waste Dept.',
  },
  notifications: {
    inApp: true,
    toasts: true,
    criticalOnly: false,
    dailyDigest: true,
  },
  thresholds: {
    warning: 80,
    high: 90,
    critical: 100,
    collection: 75,
  },
  system: {
    autoSimulate: false,
    simulationIntervalSec: 6,
    mapAutoFit: true,
  },
  theme: 'light',
}

function iso(now: number, minutesAgo: number) {
  return new Date(now - minutesAgo * 60000).toISOString()
}

function createBins(now: number, rand: () => number): Bin[] {
  const bins: Bin[] = []
  let n = 0
  AREAS.forEach((area, ai) => {
    STREETS[area.id].forEach((street, si) => {
      n += 1
      const fill = FILL_PATTERN[(ai * 7 + si) % FILL_PATTERN.length]
      const jitter = () => (rand() - 0.5) * 0.018
      bins.push({
        id: `BIN-${String(100 + n).padStart(4, '0')}`,
        location: street,
        area: area.name,
        lat: area.lat + jitter(),
        lng: area.lng + jitter(),
        fillLevel: fill,
        category: WASTE_CATEGORIES[(ai + si) % (si === 6 ? 5 : 3)],
        capacityLiters: [660, 1100, 240, 1100, 660][(ai + si) % 5],
        lastUpdated: iso(now, Math.floor(rand() * 40) + 1),
        lastCollected: iso(now, Math.floor(rand() * 2000) + 300),
        sensorBattery: Math.floor(55 + rand() * 45),
        installedOn: iso(now, 60 * 24 * (120 + Math.floor(rand() * 400))),
      })
    })
  })
  return bins
}

function createAlerts(bins: Bin[], settings: Settings): Alert[] {
  return bins
    .map((bin, i): Alert | null => {
      const severity = getAlertSeverity(bin.fillLevel, settings.thresholds)
      if (!severity) return null
      return {
        id: `ALT-${String(5000 + i)}`,
        binId: bin.id,
        location: bin.location,
        area: bin.area,
        fillLevel: bin.fillLevel,
        severity,
        status: i % 3 === 0 ? 'read' : 'unread',
        createdAt: bin.lastUpdated,
        updatedAt: bin.lastUpdated,
      }
    })
    .filter((a): a is Alert => a !== null)
}

function createVehicles(): Vehicle[] {
  const base: Omit<Vehicle, 'lat' | 'lng'>[] = [
    { id: 'TRK-01', name: 'Compactor 01', plate: 'PV-04-GT-2201', driver: 'Ravi Kumar', capacityKg: 8000, loadPct: 42, status: 'on-route', collectedTodayKg: 3360, tripsToday: 2 },
    { id: 'TRK-02', name: 'Compactor 02', plate: 'PV-04-GT-2202', driver: 'Meera Joseph', capacityKg: 8000, loadPct: 18, status: 'available', collectedTodayKg: 2140, tripsToday: 1 },
    { id: 'TRK-03', name: 'Recycler 03', plate: 'PV-04-GR-3303', driver: 'Arjun Patel', capacityKg: 6000, loadPct: 64, status: 'on-route', collectedTodayKg: 3840, tripsToday: 3 },
    { id: 'TRK-04', name: 'Organics 04', plate: 'PV-04-GO-4404', driver: 'Fatima Sheikh', capacityKg: 5000, loadPct: 0, status: 'available', collectedTodayKg: 1250, tripsToday: 1 },
    { id: 'TRK-05', name: 'Compactor 05', plate: 'PV-04-GT-2205', driver: 'Daniel Mathew', capacityKg: 8000, loadPct: 0, status: 'maintenance', collectedTodayKg: 0, tripsToday: 0 },
    { id: 'TRK-06', name: 'Mini Loader 06', plate: 'PV-04-GM-6606', driver: 'Lakshmi Nair', capacityKg: 3000, loadPct: 27, status: 'available', collectedTodayKg: 980, tripsToday: 2 },
  ]
  const positions = [
    [12.9848, 77.5801],
    [12.9716, 77.5946],
    [12.9722, 77.6161],
    [12.9575, 77.5702],
    [12.9716, 77.5946],
    [12.9884, 77.6021],
  ]
  return base.map((v, i) => ({ ...v, lat: positions[i][0], lng: positions[i][1] }))
}

export const WORKERS: Worker[] = [
  { id: 'W-101', name: 'Suresh Gowda', role: 'Field Supervisor', area: 'Riverside' },
  { id: 'W-102', name: 'Priya Menon', role: 'Sanitation Inspector', area: 'Old Town' },
  { id: 'W-103', name: 'Kiran Desai', role: 'Field Supervisor', area: 'Tech Park' },
  { id: 'W-104', name: 'Joseph Fernandes', role: 'Maintenance Crew', area: 'Harbor District' },
  { id: 'W-105', name: 'Nisha Verma', role: 'Sanitation Inspector', area: 'Green Heights' },
  { id: 'W-106', name: 'Abdul Rahman', role: 'Enforcement Officer', area: 'Market Square' },
  { id: 'W-107', name: 'Deepa Iyer', role: 'Maintenance Crew', area: 'Citywide' },
]

function createComplaints(now: number, rand: () => number): Complaint[] {
  const seeds: Array<Pick<Complaint, 'name' | 'contact' | 'category' | 'description' | 'area' | 'address' | 'status'> & { minutesAgo: number; assignedTo?: string }> = [
    { name: 'Rahul Shetty', contact: 'rahul.s@mail.com', category: 'Overflowing garbage bin', description: 'Bin near the bus stop has been overflowing since yesterday evening. Waste is spilling onto the footpath.', area: 'Market Square', address: 'Bus Terminal, Gate 2', status: 'Submitted', minutesAgo: 35 },
    { name: 'Sneha Pillai', contact: '+91 98861 22110', category: 'Illegal dumping', description: 'Construction debris dumped on the empty plot next to the park entrance.', area: 'Green Heights', address: 'Hilltop Park, north entrance', status: 'Under Review', minutesAgo: 180 },
    { name: 'Mohammed Irfan', contact: 'irfan.m@mail.com', category: 'Irregular garbage collection', description: 'Collection truck has skipped our lane for 3 days in a row.', area: 'Old Town', address: 'Lantern Alley, House 14', status: 'Assigned', minutesAgo: 420, assignedTo: 'W-102' },
    { name: 'Kavya Reddy', contact: '+91 99001 77654', category: 'Damaged garbage bin', description: 'Lid of the recycling bin is broken and stray animals are scattering waste.', area: 'Riverside', address: 'Heron Walk, near jogging track', status: 'Resolved', minutesAgo: 1500, assignedTo: 'W-101' },
    { name: 'Thomas George', contact: 'tgeorge@mail.com', category: 'Overflowing garbage bin', description: 'Organic waste bin outside the food court is full and smells badly.', area: 'Tech Park', address: 'Data Plaza food court', status: 'Assigned', minutesAgo: 95, assignedTo: 'W-103' },
    { name: 'Anita Bose', contact: '+91 90080 33421', category: 'Illegal dumping', description: 'Plastic waste and nets dumped near the pier, affecting the waterfront.', area: 'Harbor District', address: 'Pier 7, east side', status: 'Under Review', minutesAgo: 260 },
    { name: 'Vikram Singh', contact: 'vikram.s@mail.com', category: 'Other', description: 'Requesting an additional e-waste bin near the electronics market.', area: 'Market Square', address: 'Copper Lane', status: 'Submitted', minutesAgo: 610 },
    { name: 'Leela Krishnan', contact: '+91 97400 55678', category: 'Irregular garbage collection', description: 'Morning collection is happening very late, after 11 AM.', area: 'Green Heights', address: 'Maple Residency, Block C', status: 'Resolved', minutesAgo: 2900, assignedTo: 'W-105' },
    { name: 'Farhan Ali', contact: 'farhan.ali@mail.com', category: 'Damaged garbage bin', description: 'Sensor bin appears tilted after a vehicle hit it.', area: 'Old Town', address: 'Clocktower Street', status: 'Submitted', minutesAgo: 15 },
  ]
  return seeds.map((s, i) => {
    const area = AREAS.find((a) => a.name === s.area) ?? AREAS[0]
    const createdAt = iso(now, s.minutesAgo)
    const history: Complaint['history'] = [{ status: 'Submitted', at: createdAt, note: 'Complaint received via citizen portal.' }]
    const flow: Complaint['status'][] = ['Under Review', 'Assigned', 'Resolved']
    const target = flow.indexOf(s.status as (typeof flow)[number])
    for (let k = 0; k <= target; k++) {
      history.push({ status: flow[k], at: iso(now, Math.max(1, s.minutesAgo - (k + 1) * 20)) })
    }
    return {
      id: `CMP-2026-${String(41020 + i * 37)}`,
      name: s.name,
      contact: s.contact,
      category: s.category,
      description: s.description,
      area: s.area,
      address: s.address,
      lat: area.lat + (rand() - 0.5) * 0.014,
      lng: area.lng + (rand() - 0.5) * 0.014,
      status: s.status,
      assignedTo: s.assignedTo,
      createdAt,
      updatedAt: history[history.length - 1].at,
      history,
    }
  })
}

export function createSeedState(now = Date.now()): AppState {
  const rand = mulberry32(20261121)
  const settings = structuredClone(DEFAULT_SETTINGS)
  const bins = createBins(now, rand)
  const alerts = createAlerts(bins, settings)
  const complaints = createComplaints(now, rand)
  const activity: ActivityEntry[] = [
    ...alerts.map((a) => ({
      id: `ACT-${a.id}`,
      type: 'alert-created' as const,
      title: `${a.severity === 'critical' ? 'Critical' : a.severity === 'high' ? 'High priority' : 'Warning'} alert · ${a.binId}`,
      message: `${a.location}, ${a.area} reached ${a.fillLevel}% fill level.`,
      createdAt: a.createdAt,
      channel: 'in-app' as const,
    })),
    ...complaints.map((c) => ({
      id: `ACT-${c.id}`,
      type: 'complaint-submitted' as const,
      title: `New complaint · ${c.id}`,
      message: `${c.category} reported at ${c.address}, ${c.area}.`,
      createdAt: c.createdAt,
      channel: 'in-app' as const,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    version: STATE_VERSION,
    bins,
    alerts,
    activity,
    vehicles: createVehicles(),
    complaints,
    workers: WORKERS,
    routePlan: null,
    settings,
  }
}
