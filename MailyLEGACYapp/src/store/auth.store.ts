/**
 * auth.store.ts
 * -------------
 * Estado de autenticación global.
 * Reemplaza la integración con Clerk — gestiona tokens via expo-secure-store.
 */

import { create }                               from 'zustand'
import { router }                              from 'expo-router'
import { API_URL }                             from '@constants/config'
import type { UserRole }                       from '@constants/config'
import { getAccessToken, getRefreshToken, clearTokens } from '@lib/auth/session'

export interface AuthUser {
  id:        string   // UUID del backend
  email:     string
  role:      UserRole | null
  firstName: string | null
  lastName:  string | null
  photoUrl:  string | null
}

interface AuthState {
  user:       AuthUser | null
  isLoaded:   boolean   // Auth terminó de cargar (ex: tokens leídos de SecureStore)
  isSignedIn: boolean

  setUser:     (user: AuthUser | null) => void
  updateUser:  (partial: Partial<AuthUser>) => void
  setLoaded:   (v: boolean) => void
  setSignedIn: (v: boolean) => void
  clear:       () => void

  /** Cierra sesión: borra tokens, limpia estado y redirige al sign-in. */
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user:       null,
  isLoaded:   false,
  isSignedIn: false,

  setUser:     (user)    => set({ user }),
  updateUser:  (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
  setLoaded:   (v)       => set({ isLoaded: v }),
  setSignedIn: (v)       => set({ isSignedIn: v }),
  clear:       ()        => set({ user: null, isSignedIn: false }),

  signOut: async () => {
    // Fire & forget — blacklistear el refresh token en el servidor
    try {
      const [refresh, access] = await Promise.all([getRefreshToken(), getAccessToken()])
      if (refresh) {
        fetch(`${API_URL}/auth/logout/`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: JSON.stringify({ refresh }),
        }).catch(() => { /* silencioso — no bloquear el logout si falla la red */ })
      }
    } catch { /* silencioso */ }

    // Limpiar tokens locales y estado de inmediato
    await clearTokens()
    set({ user: null, isSignedIn: false })
    router.replace('/(auth)/sign-in')
  },
}))
