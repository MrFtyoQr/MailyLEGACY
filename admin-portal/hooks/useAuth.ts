'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * useAuth — reemplaza el useAuth de @clerk/nextjs.
 * Lee el mc_admin_token de las cookies del browser.
 * El token es httpOnly → no accesible por document.cookie.
 * Para las requests del cliente, el cookie se envía automáticamente con
 * credentials:'include' — actualizamos apiGet para usarlo.
 */
export function useAuth() {
  const router = useRouter()

  /**
   * getToken — para compatibilidad con la firma de apiGet existente.
   * Como el token es httpOnly, lo pedimos al backend via /api/auth/token.
   * En la práctica, las requests del cliente envían la cookie automáticamente.
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/token', { credentials: 'include' })
      if (!res.ok) return null
      const data = await res.json() as { token?: string }
      return data.token ?? null
    } catch {
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/sign-in')
    router.refresh()
  }, [router])

  return { getToken, logout }
}
