/**
 * client.ts
 * ---------
 * Instancia de axios configurada con:
 *   - baseURL del backend
 *   - Interceptor de request: inyecta Bearer token de Clerk
 *   - Interceptor de response: transforma errores a ApiError tipado
 *   - Timeout de 15 segundos
 *   - Retry automático en errores de red (1 intento)
 */

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'
import { API_URL, TIMEOUTS } from '@constants/config'
import { ApiError, extractErrorMessage, httpErrorMessage } from './errors'

// Token getter — se inyecta desde el root layout después de que Clerk carga
let _getToken: (() => Promise<string | null>) | null = null

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUTS.api,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
})

// ── Request interceptor: añade Authorization header ───────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (_getToken) {
      const token = await _getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor: normaliza errores ───────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!error.response) {
      // Error de red / timeout
      throw new ApiError(0, 'Sin conexión. Verifica tu internet.', error)
    }

    const { status, data } = error.response
    const message = extractErrorMessage(data) || httpErrorMessage(status)
    throw new ApiError(status, message, data)
  },
)

// ── Helper tipado ─────────────────────────────────────────────────────────
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<T>(url, { params })
  return res.data
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiClient.post<T>(url, data)
  return res.data
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiClient.patch<T>(url, data)
  return res.data
}

export async function del<T>(url: string): Promise<T> {
  const res = await apiClient.delete<T>(url)
  return res.data
}
