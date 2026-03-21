import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from '@/providers/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'OptimizerV6 — rectangled.io',
  description: 'AI-native Online Reputation Management for Indian businesses',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}
