import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from './primitives'

const TONES = {
  teal: 'bg-primary/12 text-primary',
  navy: 'bg-chart-2/12 text-chart-2',
  green: 'bg-success/12 text-success',
  orange: 'bg-warning/12 text-warning',
  red: 'bg-critical/12 text-critical',
} as const

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'teal',
}: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone?: keyof typeof TONES
}) {
  return (
    <Card className="group p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105', TONES[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
