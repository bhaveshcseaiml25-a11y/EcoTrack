import { BarChart3, BellRing, LayoutDashboard, MessageSquareWarning, Route, Settings, Trash2 } from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/bins', label: 'Smart Bin Monitoring', icon: Trash2 },
  { href: '/alerts', label: 'Alerts & Notifications', icon: BellRing },
  { href: '/routes', label: 'Route Optimization', icon: Route },
  { href: '/complaints', label: 'Citizen Complaints', icon: MessageSquareWarning },
  { href: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]
