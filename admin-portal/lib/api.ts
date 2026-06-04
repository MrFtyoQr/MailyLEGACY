/**
 * api.ts — Axios instance con JWT propio para el portal admin.
 *
 * Uso (client components / hooks):
 *   const { getToken } = useAuth()
 *   const data = await apiGet<DashboardData>(EP.adminDashboard, getToken)
 *
 * Uso (server components / Route Handlers):
 *   import { cookies } from 'next/headers'
 *   const token = (await cookies()).get('mc_admin_token')?.value
 *   const data = await serverApiGet<DashboardData>(EP.adminDashboard, token)
 */

import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

// ── Client-side helpers (usar en hooks y client components) ───────────────────

export function createClient(token: string) {
  return axios.create({
    baseURL: API_URL,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    timeout: 15_000,
  })
}

export async function apiGet<T>(
  url: string,
  getToken: () => Promise<string | null>,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  // Usa el proxy interno de Next.js para evitar CORS
  // /api/proxy/auth/admin/dashboard/ → backend /auth/admin/dashboard/
  const proxyBase = '/api/proxy'
  const search = params
    ? '?' + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : ''

  // url viene como "/auth/admin/dashboard/" — quitar la barra inicial
  const cleanUrl = url.replace(/^\//, '').replace(/\/$/, '')
  const res = await fetch(`${proxyBase}/${cleanUrl}${search}`, {
    headers: { 'Content-Type': 'application/json' },
    cache:   'no-store',
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Server-side helper (usar en layout.tsx y server components) ───────────────

export async function serverApiGet<T>(
  url: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const searchParams = params
    ? '?' + new URLSearchParams(params as Record<string, string>).toString()
    : ''

  const res = await fetch(`${API_URL}${url}${searchParams}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${url}`)
  }

  return res.json() as Promise<T>
}
