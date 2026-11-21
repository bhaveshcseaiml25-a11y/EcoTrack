import type { Metadata } from 'next'
import { AnalyticsPage } from '@/components/analytics/analytics-page'

export const metadata: Metadata = { title: 'Analytics & Reports' }

export default function Page() {
  return <AnalyticsPage />
}
