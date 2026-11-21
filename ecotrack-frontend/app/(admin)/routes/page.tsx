import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RoutesView } from '@/components/eco/routes/routes-view'

export const metadata: Metadata = { title: 'Route Optimization' }

export default function Page() {
  return (
    <Suspense>
      <RoutesView />
    </Suspense>
  )
}
