'use client'

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const TONES = {
  success: { icon: CheckCircle2, cls: 'text-status-normal' },
  info: { icon: Info, cls: 'text-status-info' },
  warning: { icon: AlertTriangle, cls: 'text-status-moderate' },
  error: { icon: XCircle, cls: 'text-status-critical' },
}

export function Toaster() {
  const { toasts, dismissToast } = useStore()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[1000] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, cls } = TONES[t.tone]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-lg animate-in slide-in-from-bottom-2 fade-in"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', cls)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
