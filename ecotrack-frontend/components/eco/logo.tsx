import { Recycle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ collapsed, className, tone = 'light' }: { collapsed?: boolean; className?: string; tone?: 'light' | 'dark' }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 text-white shadow-md shadow-teal-900/30">
        <Recycle className="size-5" aria-hidden="true" />
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className={cn('text-base font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-foreground')}>
            Eco<span className="text-teal-400">Track</span>
          </p>
          <p className={cn('truncate text-[10px]', tone === 'light' ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
            Smarter Waste Management. Cleaner Cities.
          </p>
        </div>
      )}
    </div>
  )
}
