import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ compact, href = '/', tone = 'sidebar' }: { compact?: boolean; href?: string; tone?: 'sidebar' | 'default' }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.13_175)] to-[oklch(0.55_0.12_195)] text-white shadow-sm">
        <Leaf className="size-5" aria-hidden />
      </span>
      <span className={cn('flex flex-col leading-tight', compact && 'sr-only')}>
        <span className={cn('text-base font-semibold tracking-tight', tone === 'sidebar' ? 'text-white' : 'text-foreground')}>EcoTrack</span>
        <span className={cn('text-[11px]', tone === 'sidebar' ? 'text-sidebar-foreground/60' : 'text-muted-foreground')}>
          Smart Waste Platform
        </span>
      </span>
    </Link>
  )
}
