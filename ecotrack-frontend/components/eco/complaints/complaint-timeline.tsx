import { Check } from 'lucide-react'
import { COMPLAINT_STATUSES, formatDateTime } from '@/lib/domain'
import type { Complaint } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ComplaintProgress({ complaint }: { complaint: Complaint }) {
  const current = COMPLAINT_STATUSES.indexOf(complaint.status)
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Complaint progress">
      {COMPLAINT_STATUSES.map((s, i) => {
        const done = i <= current
        return (
          <li key={s} className="flex flex-col gap-2" aria-current={i === current ? 'step' : undefined}>
            <span className={cn('h-1.5 rounded-full transition-colors duration-500', done ? 'bg-primary' : 'bg-muted')} />
            <span className={cn('text-[11px] font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function ComplaintTimeline({ complaint }: { complaint: Complaint }) {
  const entries = [...complaint.history].reverse()
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((h, i) => (
        <li key={`${h.at}-${i}`} className="flex gap-3">
          <span
            className={cn(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
              i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Check className="size-3" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">{h.status}</p>
            {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
            <p className="text-[11px] text-muted-foreground">{formatDateTime(h.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
