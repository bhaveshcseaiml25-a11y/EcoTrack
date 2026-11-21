import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AlertsView } from '@/components/eco/alerts/alerts-view'

export const metadata: Metadata = { title: 'Alerts & Notifications' }

export default function Page() {
  return (
    <Suspense>
      <AlertsView />
    </Suspense>
  )
}
