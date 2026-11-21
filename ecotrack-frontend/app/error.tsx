'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-critical/12 text-critical">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || 'An unexpected error occurred while loading EcoTrack.'}</p>
      <div className="flex gap-2">
        <Button size="lg" onClick={reset}>Try again</Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            localStorage.removeItem('ecotrack:demo-state')
            location.reload()
          }}
        >
          Clear demo data
        </Button>
      </div>
    </main>
  )
}
