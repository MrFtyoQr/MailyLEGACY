import { cookies } from 'next/headers'
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
  // 1. Leer token desde cookie httpOnly (establecida por /api/auth/login)
  const cookieStore = await cookies()
  const token = cookieStore.get('mc_admin_token')?.value

  if (!token) {
    redirect('/sign-in')
  }

  // 2. Verificar rol ADMIN en el backend
  // /auth/me/ devuelve { user: {...}, profile: {...}, is_complete: bool }
  let user: AdminUser | null = null
  try {
    const meData = await serverApiGet<{ user: AdminUser; is_complete: boolean }>(EP.me, token)
    user = meData?.user ?? null
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
