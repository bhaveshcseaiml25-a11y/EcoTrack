'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BIN_STATUS_META, BIN_STATUSES, getBinStatus } from '@/lib/domain'
import type { Bin } from '@/lib/types'

export const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 12,
    color: 'var(--popover-foreground)',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
  },
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  itemStyle: { color: 'var(--popover-foreground)', padding: 0 },
  cursor: { fill: 'var(--muted)', opacity: 0.6 },
} as const

export const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

export function FillDistributionChart({ bins }: { bins: Bin[] }) {
  const data = BIN_STATUSES.map((s) => ({
    key: s,
    name: BIN_STATUS_META[s].label,
    value: bins.filter((b) => getBinStatus(b.fillLevel) === s).length,
    color: BIN_STATUS_META[s].hex,
  }))
  const total = bins.length

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-[11px] text-muted-foreground">bins</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: d.color }} aria-hidden />
              {d.name}
            </span>
            <span className="font-semibold tabular-nums">
              {d.value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
