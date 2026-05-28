import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/auth/token
 * Lee la cookie httpOnly mc_admin_token y la devuelve al cliente.
 * Esto permite que los client components accedan al token sin exponer la cookie.
 * Solo accesible desde el mismo origen (same-origin).
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mc_admin_token')?.value

  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 })
  }

  return NextResponse.json({ token })
}
