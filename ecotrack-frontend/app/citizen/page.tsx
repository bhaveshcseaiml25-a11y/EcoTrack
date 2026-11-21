import type { Metadata } from 'next'
import { CitizenPortal } from '@/components/citizen/citizen-portal'

export const metadata: Metadata = { title: 'Citizen Portal' }

export default function Page() {
  return <CitizenPortal />
}
