import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { QueryProvider } from './query-provider'
import './globals.css'

export const metadata: Metadata = {
  title:       'MailyT-Cuida | Admin',
  description: 'Portal de administración — MailyT-Cuida CAMSA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full">
        <ClerkProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
