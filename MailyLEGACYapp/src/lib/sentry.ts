/**
 * sentry.ts
 * ---------
 * Inicialización de Sentry con filtros de PII médico.
 * Nunca enviamos: alergias, condiciones crónicas, signos vitales,
 * tipo de sangre, fechas de nacimiento, contactos de emergencia.
 *
 * Compatible con @sentry/react-native 7.x + SDK 54.
 */

import * as Sentry from '@sentry/react-native'
import { SENTRY_DSN } from '@constants/config'

const SENSITIVE_FIELDS = new Set([
  'allergies', 'chronic_conditions', 'blood_type', 'birth_date',
  'emergency_contact_name', 'emergency_contact_phone',
  'glucose_mgdl', 'heart_rate', 'systolic_bp', 'diastolic_bp',
  'value', 'diagnosis', 'password', 'token',
])

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : v,
    ]),
  )
}

export function initSentry() {
  if (!SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate:  0.2,
    environment:       __DEV__ ? 'development' : 'production',
    debug:             false,          // evita spam de logs en consola
    attachStacktrace:  true,

    beforeSend(event) {
      // Strip PII del body de requests
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = stripSensitive(
          event.request.data as Record<string, unknown>,
        )
      }
      // Strip PII de breadcrumbs
      const breadcrumbValues = event.breadcrumbs?.values
      if (Array.isArray(breadcrumbValues)) {
        breadcrumbValues.forEach((bc: { data?: unknown }) => {
          if (bc.data && typeof bc.data === 'object') {
            bc.data = stripSensitive(bc.data as Record<string, unknown>)
          }
        })
      }
      return event
    },
  })
}

/** HOC para envolver el root de la app con Sentry error boundary */
export const SentryErrorBoundary = Sentry.ErrorBoundary
