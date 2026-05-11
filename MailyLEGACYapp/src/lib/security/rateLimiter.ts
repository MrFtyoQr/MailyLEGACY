/**
 * rateLimiter.ts
 * --------------
 * Rate limiter client-side para proteger formularios de spam.
 * Complementa el rate limiting del backend.
 *
 * Uso:
 *   const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 30_000 })
 *   limiter.attempt() → { allowed: true } | { allowed: false, retryAfterMs: number }
 */

export interface RateLimiterOptions {
  maxAttempts: number   // intentos permitidos en la ventana
  windowMs:    number   // ventana en milisegundos
}

export type AttemptResult =
  | { allowed: true; message?: never }
  | { allowed: false; retryAfterMs: number; message: string }

export interface RateLimiter {
  attempt(): AttemptResult
  reset(): void
  remaining(): number
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const attempts: number[] = []

  function prune() {
    const now = Date.now()
    while (attempts.length > 0 && now - attempts[0] > opts.windowMs) {
      attempts.shift()
    }
  }

  return {
    attempt(): AttemptResult {
      prune()
      if (attempts.length >= opts.maxAttempts) {
        const oldest = attempts[0]
        const retryAfterMs = Math.max(0, opts.windowMs - (Date.now() - oldest))
        return {
          allowed: false,
          retryAfterMs,
          message: `Demasiados intentos. Espera ${formatRetryAfter(retryAfterMs)}.`,
        }
      }
      attempts.push(Date.now())
      return { allowed: true }
    },

    reset() {
      attempts.length = 0
    },

    remaining() {
      prune()
      return Math.max(0, opts.maxAttempts - attempts.length)
    },
  }
}

/** Formatea ms en texto legible: "30 segundos", "1 minuto" */
export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds} segundo${seconds !== 1 ? 's' : ''}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
}
