import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ComplaintsPage } from '@/components/complaints/complaints-page'

export const metadata: Metadata = { title: 'Citizen Complaints' }

export default function Page() {
  return (
    <Suspense>
      <ComplaintsPage />
    </Suspense>
  )
}
