import type { Metadata } from 'next'
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
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}
