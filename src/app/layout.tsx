// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import ToastProvider from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'From Zero Starter',
  description: 'API Monetization Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="h-screen overflow-hidden bg-background text-foreground" suppressHydrationWarning>
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
