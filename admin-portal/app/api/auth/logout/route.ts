import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

/**
 * POST /api/auth/logout
 * Blacklistea el refresh token en el backend y limpia las cookies.
 */
export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('mc_refresh_token')?.value
  const accessToken  = cookieStore.get('mc_admin_token')?.value

  // Intentar blacklistear en el backend (best-effort)
  if (refreshToken && accessToken) {
    try {
      await fetch(`${API_URL}/auth/logout/`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh: refreshToken }),
      })
    } catch {
      // Si el backend falla, igual limpiamos las cookies locales
    }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.delete('mc_admin_token')
  res.cookies.delete('mc_refresh_token')
  return res
}
