import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BinsPage } from '@/components/bins/bins-page'

export const metadata: Metadata = { title: 'Smart Bin Monitoring' }

export default function Page() {
  return (
    <Suspense>
      <BinsPage />
    </Suspense>
  )
}
