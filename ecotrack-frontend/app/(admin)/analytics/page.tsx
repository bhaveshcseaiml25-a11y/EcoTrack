import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AnalyticsView } from '@/components/eco/analytics/analytics-view'

export const metadata: Metadata = { title: 'Analytics & Reports' }

export default function Page() {
  return (
    <Suspense>
      <AnalyticsView />
    </Suspense>
  )
}
