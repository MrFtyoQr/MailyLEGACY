/**
 * useFormGuard.ts
 * ---------------
 * Higher-order hook que combina:
 *   1. Validación Zod
 *   2. Sanitización de strings
 *   3. Rate limiting client-side
 *   4. Estado de submit (loading / error)
 *
 * Uso:
 *   const { submit, isSubmitting, formError } = useFormGuard({
 *     schema: signInSchema,
 *     rateLimiter: signInLimiter,
 *     onSubmit: async (data) => { ... },
 *   })
 */

import { useState, useCallback } from 'react'
import { ZodSchema, ZodError } from 'zod'
import * as Sentry from '@sentry/react-native'
import { sanitizeObject } from '@lib/security/sanitize'
import type { RateLimiter } from '@lib/security/rateLimiter'

const FALLBACK_ERROR_MSG = 'Ocurrió un error. Inténtalo de nuevo.'
const NETWORK_ERROR_MSG =
  'No pudimos conectar con el servidor. Verifica tu conexión o inténtalo más tarde.'

/** Patrones de mensajes técnicos que nunca deben verse en pantalla */
const TECHNICAL_PATTERNS = [
  /json parse/i,
  /unexpected token/i,
  /unexpected character/i,
  /syntaxerror/i,
  /network request failed/i,
  /failed to fetch/i,
]

/** Convierte cualquier error en un mensaje apto para el usuario y reporta a Sentry. */
function toUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return FALLBACK_ERROR_MSG

  if (TECHNICAL_PATTERNS.some((re) => re.test(err.message))) {
    try { Sentry.captureException(err) } catch { /* no romper el flujo */ }
    return NETWORK_ERROR_MSG
  }
  return err.message || FALLBACK_ERROR_MSG
}

interface UseFormGuardOptions<TInput, TOutput> {
  /** Zod schema para validar y transformar el input */
  schema: ZodSchema<TOutput>
  /** Rate limiter instance (opcional — si no se pasa, no limita) */
  rateLimiter?: RateLimiter
  /** Callback ejecutado solo si validación + rate limit pasan */
  onSubmit: (data: TOutput) => Promise<void>
}

interface FormGuardResult<TInput> {
  /** Lanza validación + rate limit + onSubmit */
  submit: (rawData: TInput) => Promise<void>
  isSubmitting: boolean
  /** Error de rate limit, validación global o de red */
  formError: string | null
  /** Errores por campo { fieldName: mensaje } */
  fieldErrors: Partial<Record<keyof TInput, string>>
  /** Limpia errores manualmente */
  clearErrors: () => void
}

export function useFormGuard<TInput extends Record<string, unknown>, TOutput>(
  options: UseFormGuardOptions<TInput, TOutput>,
): FormGuardResult<TInput> {
  const { schema, rateLimiter, onSubmit } = options

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)
  const [fieldErrors, setFieldErrors]   = useState<Partial<Record<keyof TInput, string>>>({})

  const clearErrors = useCallback(() => {
    setFormError(null)
    setFieldErrors({})
  }, [])

  const submit = useCallback(
    async (rawData: TInput) => {
      if (isSubmitting) return
      clearErrors()

      // 1. Rate limit check
      if (rateLimiter) {
        const rl = rateLimiter.attempt()
        if (!rl.allowed) {
          setFormError(rl.message ?? 'Demasiados intentos. Espera un momento.')
          return
        }
      }

      // 2. Sanitizar strings del objeto
      const sanitized = sanitizeObject(rawData) as TInput

      // 3. Validar con Zod
      const result = schema.safeParse(sanitized)
      if (!result.success) {
        const ze = result.error as ZodError
        const fe: Partial<Record<keyof TInput, string>> = {}
        ze.errors.forEach((err) => {
          const field = err.path[0] as keyof TInput
          if (field && !fe[field]) fe[field] = err.message
        })
        setFieldErrors(fe)
        return
      }

      // 4. Submit
      setIsSubmitting(true)
      try {
        await onSubmit(result.data)
      } catch (err: unknown) {
        // Nunca mostrar mensajes técnicos crudos (BUG #1)
        setFormError(toUserMessage(err))
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, rateLimiter, schema, onSubmit, clearErrors],
  )

  return { submit, isSubmitting, formError, fieldErrors, clearErrors }
}
