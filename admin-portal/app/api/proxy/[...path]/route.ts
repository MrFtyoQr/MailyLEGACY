/**
 * /api/proxy/[...path]
 * --------------------
 * Proxy transparente hacia el backend Django.
 * El browser llama a /api/proxy/auth/admin/dashboard/
 * y este route lo reenvía a NEXT_PUBLIC_API_URL/auth/admin/dashboard/
 *
 * Ventaja: elimina CORS completamente — el browser solo habla con Next.js,
 * nunca directamente con Django.
 */

import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const endpoint  = path.join('/')
  const search    = req.nextUrl.search ?? ''
  const targetUrl = `${API_URL}/${endpoint}/${search}`

  // Leer token de la cookie httpOnly
  const cookieStore = await cookies()
  const token = cookieStore.get('mc_admin_token')?.value

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text()
  }

  const upstream = await fetch(targetUrl, {
    method:  req.method,
    headers,
    body,
    cache:   'no-store',
  })

  const text = await upstream.text()
  return new NextResponse(text, {
    status:  upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const GET    = handler
export const POST   = handler
export const PATCH  = handler
export const PUT    = handler
export const DELETE = handler
