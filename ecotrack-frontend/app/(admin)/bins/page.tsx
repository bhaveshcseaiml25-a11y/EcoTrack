import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BinsView } from '@/components/eco/bins/bins-view'

export const metadata: Metadata = { title: 'Smart Bin Monitoring' }

export default function Page() {
  return (
    <Suspense>
      <BinsView />
    </Suspense>
  )
}
