import { NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

/**
 * POST /api/auth/login
 * Proxy al backend /api/v1/auth/login/ — establece cookies httpOnly con los tokens.
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos.' }, { status: 400 })
  }

  // Llamar al backend
  let backendData: { access: string; refresh: string; user: { id: string; email: string; role: string } }
  try {
    const backendRes = await fetch(`${API_URL}/auth/login/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: body.email, password: body.password }),
    })

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as { error?: string }).error ?? 'Credenciales incorrectas.' },
        { status: 401 },
      )
    }

    backendData = await backendRes.json()
  } catch {
    return NextResponse.json({ error: 'Error de conexión con el servidor.' }, { status: 503 })
  }

  // Verificar que el usuario sea ADMIN
  if (backendData.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Tu cuenta no tiene permisos de administrador.' },
      { status: 403 },
    )
  }

  // Establecer cookies
  const isProd = process.env.NODE_ENV === 'production'
  const res = NextResponse.json({
    success: true,
    user: backendData.user,
  })

  // Access token — cookie readable por el servidor (no httpOnly para que Next.js lo pueda leer)
  res.cookies.set('mc_admin_token', backendData.access, {
    httpOnly: true,        // Solo el servidor lo lee; el JS del cliente NO
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60,     // 1 hora (igual que el token)
  })

  // Refresh token — httpOnly, solo accesible vía /api/auth/*
  res.cookies.set('mc_refresh_token', backendData.refresh, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/api/auth',  // Solo se envía a rutas de auth
    maxAge:   30 * 24 * 60 * 60,  // 30 días
  })

  return res
}
