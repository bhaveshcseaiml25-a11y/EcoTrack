import { Check } from 'lucide-react'
import { COMPLAINT_STATUS_META, COMPLAINT_STATUS_ORDER } from '@/lib/constants'
import { formatDateTime } from '@/lib/logic'
import type { Complaint } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ComplaintTimeline({ complaint }: { complaint: Complaint }) {
  const currentIdx = COMPLAINT_STATUS_ORDER.indexOf(complaint.status)
  return (
    <ol className="flex flex-col">
      {COMPLAINT_STATUS_ORDER.map((s, i) => {
        const entry = [...complaint.history].reverse().find((h) => h.status === s)
        const reached = i <= currentIdx
        const last = i === COMPLAINT_STATUS_ORDER.length - 1
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-white',
                  reached ? 'border-transparent' : 'border-border bg-card',
                )}
                style={reached ? { background: COMPLAINT_STATUS_META[s].color } : undefined}
              >
                {reached && <Check className="size-3.5" aria-hidden="true" />}
              </span>
              {!last && <span className={cn('my-1 w-0.5 flex-1', i < currentIdx ? 'bg-primary/50' : 'bg-border')} />}
            </div>
            <div className={cn('pb-5', last && 'pb-0')}>
              <p className={cn('text-sm font-medium', !reached && 'text-muted-foreground')}>{COMPLAINT_STATUS_META[s].label}</p>
              {entry ? (
                <>
                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                  {entry.note && <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs">{entry.note}</p>}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{reached ? 'Completed' : 'Pending'}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
