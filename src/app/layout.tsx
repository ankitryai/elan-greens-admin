import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Elan Greens Admin',
  description: 'Internal admin panel for Elan Greens plant directory',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Dancing Script only for the élan wordmark — loaded once globally */}
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        {children}
        {/* Toaster renders toast notifications app-wide from any page */}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
