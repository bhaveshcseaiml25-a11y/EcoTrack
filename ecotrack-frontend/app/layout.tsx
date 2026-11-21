import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { StoreProvider } from '@/lib/store'
import { Toaster } from '@/components/eco/toaster'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: {
    default: 'EcoTrack – Smart City Waste Management',
    template: '%s · EcoTrack',
  },
  description:
    'EcoTrack: Smarter Waste Management. Cleaner Cities. Monitor IoT smart bins, automate municipal alerts, optimize collection routes and manage citizen complaints.',
  generator: 'v0.app',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#16243f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <StoreProvider>
          {children}
          <Toaster />
        </StoreProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
