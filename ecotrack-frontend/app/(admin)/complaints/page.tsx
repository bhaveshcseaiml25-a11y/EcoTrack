import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ComplaintsView } from '@/components/eco/complaints/complaints-view'

export const metadata: Metadata = { title: 'Citizen Complaints' }

export default function Page() {
  return (
    <Suspense>
      <ComplaintsView />
    </Suspense>
  )
}
