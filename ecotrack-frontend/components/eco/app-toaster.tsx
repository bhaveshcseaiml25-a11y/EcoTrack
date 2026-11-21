'use client'

import { Toaster } from 'sonner'
import { useStore } from '@/lib/store'

export function AppToaster() {
  const { state } = useStore()
  return <Toaster richColors closeButton position="top-right" theme={state.settings.theme} />
}
