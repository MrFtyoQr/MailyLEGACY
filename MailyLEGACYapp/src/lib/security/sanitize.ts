/**
 * sanitize.ts
 * -----------
 * Limpia inputs de texto antes de enviarlos al backend o mostrarlos.
 * En React Native no existe DOM/HTML, pero sí pueden colarse:
 *   - Null bytes y caracteres de control
 *   - Zero-width characters (​ ‍ ﻿ etc.) usados para bypass de filtros
 *   - Secuencias Unicode de overlong / directionality override (RLO, LRO)
 */

/** Caracteres peligrosos en inputs de texto nativo */
const CONTROL_CHARS   = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const ZERO_WIDTH      = /[​-‍﻿⁠]/g
const BIDI_OVERRIDE   = /[‪-‮⁦-⁩]/g

/**
 * Sanitiza un string de input:
 * - Elimina control chars, zero-width y bidi overrides
 * - Trunca al máximo permitido
 * - Trim de espacios extremos
 */
export function sanitizeInput(value: string, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(BIDI_OVERRIDE, '')
    .slice(0, maxLength)
    .trim()
}

/**
 * Sanitiza todos los valores string de un objeto plano.
 * Útil para limpiar el body antes de enviarlo al API.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  maxLength = 500,
): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === 'string' ? sanitizeInput(v, maxLength) : v,
    ]),
  ) as T
}

/**
 * Hook-friendly: devuelve un handler onChangeText que sanitiza on-the-fly.
 */
export function makeSanitizedHandler(
  setter: (v: string) => void,
  maxLength = 500,
) {
  return (value: string) => setter(sanitizeInput(value, maxLength))
}
