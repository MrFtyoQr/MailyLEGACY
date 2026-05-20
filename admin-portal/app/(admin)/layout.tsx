import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { serverApiGet } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import type { AdminUser } from '@/types'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Clerk auth — si no hay sesión, middleware ya redirige a /sign-in
  //    pero hacemos doble check aquí por seguridad
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) {
    redirect('/sign-in')
  }

  // 2. Verificar rol ADMIN en el backend
  let user: AdminUser | null = null
  try {
    user = await serverApiGet<AdminUser>(EP.me, token)
  } catch {
    redirect('/sign-in?error=unauthorized')
  }

  if (!user || user.role !== 'ADMIN') {
    redirect('/sign-in?error=unauthorized')
  }

  return (
    <div className="flex h-full" style={{ background: '#F8FAFC' }}>
      {/* Sidebar fijo */}
      <Sidebar adminEmail={user.email} />

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
