/**
 * errors.ts
 * ---------
 * Clase ApiError tipada y helpers para mapear errores HTTP
 * a mensajes amigables en español.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly raw?: unknown,
  ) {
    super(detail)
    this.name = 'ApiError'
  }

  get isUnauthorized() { return this.status === 401 }
  get isForbidden()    { return this.status === 403 }
  get isNotFound()     { return this.status === 404 }
  get isThrottled()    { return this.status === 429 }
  get isServer()       { return this.status >= 500 }
}

/** Extrae el mensaje de error del body de respuesta del backend */
export function extractErrorMessage(data: unknown): string {
  if (typeof data === 'string') return data
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    if (typeof d.error === 'string') return d.error
    // DRF field errors: { field: ['msg'] }
    const firstField = Object.values(d)[0]
    if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
      return firstField[0]
    }
  }
  return 'Error desconocido. Intenta de nuevo.'
}

/** Mensajes en español para códigos HTTP comunes */
export function httpErrorMessage(status: number): string {
  switch (status) {
    case 400: return 'Datos inválidos. Revisa el formulario.'
    case 401: return 'Sesión expirada. Inicia sesión de nuevo.'
    case 403: return 'No tienes permiso para realizar esta acción.'
    case 404: return 'Recurso no encontrado.'
    case 429: return 'Demasiados intentos. Espera un momento.'
    case 500: return 'Error del servidor. Intenta más tarde.'
    case 502: return 'Servicio no disponible. Intenta más tarde.'
    case 503: return 'Servicio en mantenimiento. Intenta más tarde.'
    default:  return 'Error de red. Verifica tu conexión.'
  }
}
