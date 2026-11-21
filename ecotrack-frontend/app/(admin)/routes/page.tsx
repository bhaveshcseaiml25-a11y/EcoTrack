import type { Metadata } from 'next'
import { RoutesPage } from '@/components/routes/routes-page'

export const metadata: Metadata = { title: 'Route Optimization' }

export default function Page() {
  return <RoutesPage />
}
