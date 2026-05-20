/**
 * api.ts — Axios instance con Clerk JWT para el portal admin.
 *
 * Uso (client components):
 *   const { getToken } = useAuth()
 *   const data = await apiGet<DashboardData>(EP.adminDashboard, getToken)
 *
 * Uso (server components / Route Handlers):
 *   const { getToken } = auth()
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
  const token = await getToken()
  if (!token) throw new Error('No auth token')
  const client = createClient(token)
  const res = await client.get<T>(url, { params })
  return res.data
}

// ── Server-side helper (usar en layout.tsx server components) ─────────────────

export async function serverApiGet<T>(
  url: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    ...(params
      ? { }
      : {}),
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${url}`)
  }
  return res.json() as Promise<T>
}
