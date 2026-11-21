'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Fuel, Leaf, Navigation, Scale, TrendingUp } from 'lucide-react'
import { Card, CardHeader, PageHeader, Select } from '@/components/eco/primitives'
import { Button } from '@/components/ui/button'
import { buildAnalytics, type AnalyticsQuery } from '@/lib/analytics'
import { AREAS } from '@/lib/constants'
import { useStore } from '@/lib/store'

const axis = { fontSize: 11, fill: 'var(--muted-foreground)' }
const tooltipStyle = { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--popover-foreground)' }

function ChartCard({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      <div className="h-64 p-4">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function AnalyticsPage() {
  const { db, notify } = useStore()
  const [query, setQuery] = useState<AnalyticsQuery>({ days: 30, area: 'all' })
  const data = useMemo(() => (db ? buildAnalytics(db, query) : null), [db, query])
  if (!db || !data) return null

  const exportCsv = () => {
    const rows = [['date', 'collected_kg', 'generated_kg', 'efficiency_pct'], ...data.daily.map((d) => [d.date, d.collected, d.generated, d.efficiency])]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecotrack-report-${query.area.replace(/\s/g, '-').toLowerCase()}-${query.days}d.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify({ tone: 'success', title: 'Report exported', description: a.download })
  }

  const impact = [
    { label: 'Fuel saved', value: `${data.impact.fuelSavedL.toLocaleString()} L`, icon: Fuel },
    { label: 'Distance reduced', value: `${data.impact.distanceReducedKm.toLocaleString()} km`, icon: Navigation },
    { label: 'Efficiency gain', value: `${data.impact.efficiencyGain > 0 ? '+' : ''}${data.impact.efficiencyGain}%`, icon: TrendingUp },
    { label: 'CO₂ avoided', value: `${data.impact.co2AvoidedKg.toLocaleString()} kg`, icon: Leaf },
    { label: 'Waste collected', value: `${data.impact.totalCollectedT} t`, icon: Scale },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics & reports"
        description="Historical figures are generated deterministically for demonstration and blended with live dataset values."
        actions={
          <>
            <Select value={query.days} onChange={(e) => setQuery((q) => ({ ...q, days: Number(e.target.value) as AnalyticsQuery['days'] }))} className="w-36" aria-label="Date range">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </Select>
            <Select value={query.area} onChange={(e) => setQuery((q) => ({ ...q, area: e.target.value }))} className="w-44" aria-label="Area">
              <option value="all">All areas</option>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
          </>
        }
      />

      <section aria-label="Environmental impact" className="rounded-xl border bg-gradient-to-br from-teal-700 to-navy p-5 text-white shadow-sm">
        <p className="text-xs font-medium tracking-wider text-teal-200 uppercase">Environmental impact (simulated)</p>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-5">
          {impact.map((i) => (
            <div key={i.label}>
              <i.icon className="size-4 text-teal-300" aria-hidden="true" />
              <p className="mt-1.5 text-xl font-semibold tabular-nums">{i.value}</p>
              <p className="text-xs text-white/70">{i.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily waste collection" description="Collected vs generated (kg)">
          <AreaChart data={data.daily} margin={{ left: -8, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="an-col" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={20} />
            <YAxis tick={axis} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="generated" name="Generated" stroke="var(--chart-2)" fill="transparent" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="collected" name="Collected" stroke="var(--chart-1)" strokeWidth={2} fill="url(#an-col)" />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Weekly collection" description="Total kg per week">
          <BarChart data={data.weekly} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
            <Bar dataKey="collected" name="Collected (kg)" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Area-wise waste generation" description="Tonnes in selected period">
          <BarChart data={data.areaWise} layout="vertical" margin={{ left: 24, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="area" tick={axis} axisLine={false} tickLine={false} width={96} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
            <Bar dataKey="tonnes" name="Tonnes" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Bin fill-level distribution" description="Live sensor snapshot">
          <PieChart>
            <Pie data={data.fillDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
              {data.fillDistribution.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Complaint trends" description="Received vs resolved">
          <LineChart data={data.complaintTrend} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="received" name="Received" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="resolved" name="Resolved" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Vehicle performance" description="Trips and tonnes per vehicle">
          <BarChart data={data.vehiclePerformance} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="vehicle" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="trips" name="Trips" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="tonnes" name="Tonnes" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}
