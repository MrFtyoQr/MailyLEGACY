import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}

/** URL base del backend (sin trailing slash) */
export const API_BASE_URL: string =
  (extra.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'https://mailyt-cuidalegacy-iihlu.sevalla.app'

/** URL base para WebSockets — convierte https→wss, http→ws */
export const WS_BASE_URL: string = API_BASE_URL.replace(/^http/, 'ws')

/** Versión del API */
export const API_VERSION = '/api/v1'

/** URL completa del API */
export const API_URL = `${API_BASE_URL}${API_VERSION}`

/** @deprecated Clerk ha sido eliminado — mantener para referencias residuales */
export const CLERK_PUBLISHABLE_KEY = ''
/** @deprecated */
export const EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = ''

/** Sentry DSN */
export const SENTRY_DSN: string =
  (extra.sentryDsn as string | undefined) ??
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  ''

/** Timeouts en milisegundos */
export const TIMEOUTS = {
  api:        15_000, // 15s para requests HTTP
  wsConnect:  10_000, // 10s para conectar WebSocket
  wsReconnect: 30_000, // máx backoff WebSocket
} as const

/** Límites de seguridad */
export const SECURITY = {
  maxImageBytes:    5  * 1024 * 1024, // 5 MB
  maxDocBytes:      20 * 1024 * 1024, // 20 MB
  maxInputLength:   500,              // caracteres por campo
  maxMessageLength: 5_000,            // chat WebSocket
  rateLimitWindow:  30_000,           // ventana rate limit en ms
} as const

/** Roles de usuario */
export const USER_ROLES = {
  PATIENT:    'PATIENT',
  DOCTOR:     'DOCTOR',
  SPECIALIST: 'SPECIALIST',
  PARTNER:    'PARTNER',
  ADMIN:      'ADMIN',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]
