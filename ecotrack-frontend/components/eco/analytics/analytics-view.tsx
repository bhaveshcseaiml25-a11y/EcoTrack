'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Download, Gauge, MapPin, MessageSquareWarning, PieChart, Printer, Recycle, Scale, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import { aggregate, getDailyHistory, getMonthlyStats } from '@/lib/analytics-data'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, PageHeader, Segmented, Select, SimulatedTag } from '../primitives'
import { StatCard } from '../stat-card'
import { axisProps, FillDistributionChart, tooltipStyle } from '../charts'

type Range = '7' | '30' | '90'
type Granularity = 'daily' | 'weekly' | 'monthly'

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AnalyticsView() {
  const { state } = useStore()
  const [range, setRange] = useState<Range>('30')
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [area, setArea] = useState('all')

  const history = useMemo(() => getDailyHistory(Number(range)), [range])
  const areas = Object.keys(history[0]?.byArea ?? {})

  const scaled = useMemo(
    () =>
      history.map((d) => {
        if (area === 'all') return d
        const ratio = d.byArea[area] / d.total
        return {
          ...d,
          general: +(d.general * ratio).toFixed(1),
          recyclable: +(d.recyclable * ratio).toFixed(1),
          organic: +(d.organic * ratio).toFixed(1),
          total: d.byArea[area],
        }
      }),
    [history, area],
  )

  const trend = useMemo(() => {
    if (granularity === 'daily') return scaled
    if (granularity === 'weekly') return aggregate(scaled, 7, (s) => `Wk of ${s.label}`)
    return getMonthlyStats()
  }, [scaled, granularity])

  const areaTotals = useMemo(
    () =>
      areas
        .map((a) => ({ area: a, tons: +history.reduce((s, d) => s + d.byArea[a], 0).toFixed(0) }))
        .sort((x, y) => y.tons - x.tons),
    [areas, history],
  )

  const totalTons = scaled.reduce((s, d) => s + d.total, 0)
  const recyclable = scaled.reduce((s, d) => s + d.recyclable, 0)
  const avgEfficiency = history.reduce((s, d) => s + d.efficiency, 0) / Math.max(1, history.length)
  const received = history.reduce((s, d) => s + d.complaintsReceived, 0)
  const resolved = history.reduce((s, d) => s + d.complaintsResolved, 0)

  function exportCsv() {
    downloadCsv(`ecotrack-report-${range}d${area !== 'all' ? `-${area.toLowerCase().replace(/\s+/g, '-')}` : ''}.csv`, [
      ['Date', 'General (t)', 'Recyclable (t)', 'Organic (t)', 'Total (t)', 'Collections', 'Complaints received', 'Complaints resolved', 'Efficiency (%)'],
      ...scaled.map((d) => [d.date, d.general, d.recyclable, d.organic, d.total, d.collections, d.complaintsReceived, d.complaintsResolved, d.efficiency]),
    ])
    toast.success('Report exported', { description: `${scaled.length} rows downloaded as CSV.` })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics & Reports"
        description="Historical waste generation, collection performance and citizen engagement across the city."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print
            </Button>
            <Button onClick={exportCsv}>
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
          </>
        }
      />

      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
          <Segmented
            label="Granularity"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <Select aria-label="Filter by area" value={area} onChange={(e) => setArea(e.target.value)} className="w-44">
            <option value="all">All areas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <SimulatedTag />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waste collected" value={`${totalTons.toFixed(0)} t`} hint={`${(totalTons / history.length).toFixed(1)} t / day`} icon={Scale} tone="navy" />
        <StatCard label="Recycling share" value={`${((recyclable / Math.max(1, totalTons)) * 100).toFixed(1)}%`} hint={`${recyclable.toFixed(0)} t recyclable`} icon={Recycle} tone="green" />
        <StatCard label="Collection efficiency" value={`${avgEfficiency.toFixed(1)}%`} hint="On-time pickups" icon={Gauge} tone="teal" />
        <StatCard label="Complaint resolution" value={`${((resolved / Math.max(1, received)) * 100).toFixed(0)}%`} hint={`${resolved} of ${received} resolved`} icon={MessageSquareWarning} tone="orange" />
      </div>

      <Card>
        <CardHeader
          icon={TrendingUp}
          title="Waste generation trend"
          description={`Tonnes by category${area !== 'all' ? ` · ${area}` : ''} · ${granularity}`}
        />
        <div className="h-80 p-5 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ left: -12, right: 8 }}>
              <defs>
                {(['chart-1', 'chart-2', 'chart-3'] as const).map((c) => (
                  <linearGradient key={c} id={`g-${c}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--${c})`} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={`var(--${c})`} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="general" name="General" stackId="1" stroke="var(--chart-2)" fill="url(#g-chart-2)" strokeWidth={2} />
              <Area type="monotone" dataKey="recyclable" name="Recyclable" stackId="1" stroke="var(--chart-1)" fill="url(#g-chart-1)" strokeWidth={2} />
              <Area type="monotone" dataKey="organic" name="Organic" stackId="1" stroke="var(--chart-3)" fill="url(#g-chart-3)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={MapPin} title="Area-wise waste generation" description={`Total tonnes · last ${range} days`} />
          <div className="h-72 p-5 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaTotals} layout="vertical" margin={{ left: 12, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="area" {...axisProps} width={96} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="tons" name="Tonnes" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader icon={PieChart} title="Current bin fill levels" description="Live snapshot from sensors" />
          <div className="p-5 pt-4">
            <FillDistributionChart bins={state.bins} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={MessageSquareWarning} title="Complaint trends" description="Received vs resolved per day" />
          <div className="h-64 p-5 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ left: -18, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="complaintsReceived" name="Received" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="complaintsResolved" name="Resolved" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader icon={BarChart3} title="Collection efficiency" description="Share of bins collected before overflow" />
          <div className="h-64 p-5 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ left: -18, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} domain={[75, 100]} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="efficiency" name="Efficiency %" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
