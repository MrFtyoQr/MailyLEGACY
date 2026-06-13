/**
 * parseResponse.ts
 * ----------------
 * Parseo seguro de respuestas `fetch` (BUG #1 — "JSON Parse error: Unexpected character: <").
 *
 * Nunca llama res.json() directo: valida Content-Type y detecta HTML
 * (páginas de error 404/502/503 del proxy, mantenimiento, WAF) antes
 * de intentar parsear. Si la respuesta no es JSON válido lanza un
 * ApiError con mensaje amigable y reporta el detalle real a Sentry.
 *
 * Uso (reemplaza `await res.json()`):
 *   const res  = await fetch(`${API_URL}/auth/login/`, { ... })
 *   const json = await parseApiResponse<LoginResponse>(res)
 *   // parseApiResponse ya valida res.ok — no hace falta chequear de nuevo.
 */

import * as Sentry from '@sentry/react-native'
import { ApiError, extractErrorMessage, httpErrorMessage } from './errors'

const SERVER_UNEXPECTED_MSG =
  'No pudimos conectar con el servidor. Verifica tu conexión o inténtalo más tarde.'

function reportToSentry(res: Response, bodySnippet: string, reason: string) {
  try {
    Sentry.captureMessage(`API non-JSON response: ${reason}`, {
      level: 'error',
      extra: {
        url:         res.url,
        status:      res.status,
        contentType: res.headers.get('content-type') ?? '(none)',
        bodyStart:   bodySnippet,
      },
    })
  } catch { /* Sentry no debe romper el flujo */ }
}

/**
 * Lee y parsea el body de una Response de forma segura.
 * - Si el body es HTML o el Content-Type no es JSON → ApiError amigable + Sentry.
 * - Si el JSON es inválido → ApiError amigable + Sentry.
 * - Si res.ok es false → ApiError con el mensaje del backend o el genérico HTTP.
 */
export async function parseApiResponse<T>(res: Response): Promise<T> {
  const text          = await res.text()
  const contentType   = res.headers.get('content-type') ?? ''
  const looksLikeHtml = text.trimStart().startsWith('<')
  const snippet       = text.slice(0, 200)

  if (looksLikeHtml || !contentType.includes('application/json')) {
    reportToSentry(res, snippet, looksLikeHtml ? 'HTML body' : `content-type "${contentType}"`)
    throw new ApiError(
      res.status,
      res.ok ? SERVER_UNEXPECTED_MSG : httpErrorMessage(res.status),
      snippet,
    )
  }

  let data: unknown
  try {
    data = text.length > 0 ? JSON.parse(text) : {}
  } catch {
    reportToSentry(res, snippet, 'invalid JSON')
    throw new ApiError(res.status, SERVER_UNEXPECTED_MSG, snippet)
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      extractErrorMessage(data) || httpErrorMessage(res.status),
      data,
    )
  }

  return data as T
}
