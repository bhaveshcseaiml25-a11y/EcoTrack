import type { Metadata } from 'next'
import { CitizenPortal } from '@/components/eco/citizen/citizen-portal'

export const metadata: Metadata = {
  title: 'Citizen Portal',
  description: 'Report waste issues and track complaint status.',
}

export default function Page() {
  return <CitizenPortal />
}
