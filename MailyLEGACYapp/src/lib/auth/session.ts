/**
 * session.ts
 * ----------
 * Gestión de tokens JWT en expo-secure-store.
 * Reemplaza el tokenCache de Clerk.
 *
 * Claves:
 *   mc_access_token  — JWT de acceso (1h)
 *   mc_refresh_token — JWT de refresco (30 días)
 */

import * as SecureStore from 'expo-secure-store'

const ACCESS_KEY  = 'mc_access_token'
const REFRESH_KEY = 'mc_refresh_token'

/** Obtiene el access token (o null si no existe). */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_KEY)
  } catch {
    return null
  }
}

/** Obtiene el refresh token (o null si no existe). */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY)
  } catch {
    return null
  }
}

/** Guarda ambos tokens en SecureStore. */
export async function setTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access),
    SecureStore.setItemAsync(REFRESH_KEY, refresh),
  ])
}

/** Elimina ambos tokens (logout). */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ])
}

/** Intenta refrescar el access token usando el refresh token.
 *  Devuelve el nuevo access token, o null si falla. */
export async function tryRefreshTokens(apiUrl: string): Promise<string | null> {
  const refresh = await getRefreshToken()
  if (!refresh) return null

  try {
    const res = await fetch(`${apiUrl}/auth/refresh/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh }),
    })

    if (!res.ok) {
      await clearTokens()
      return null
    }

    const data = await res.json() as { access: string; refresh?: string }
    const newAccess = data.access
    const newRefresh = data.refresh ?? refresh   // Backend rota el refresh

    await setTokens(newAccess, newRefresh)
    return newAccess
  } catch {
    return null
  }
}
