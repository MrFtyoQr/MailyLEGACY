/**
 * auth.store.ts
 * -------------
 * Estado de autenticación global sincronizado con Clerk.
 * Zustand store — sin persistencia (Clerk maneja el token en SecureStore).
 */

import { create } from 'zustand'
import { UserRole } from '@constants/config'

export interface AuthUser {
  id:        string   // UUID del backend
  clerkId:   string
  email:     string
  role:      UserRole | null
  firstName: string | null
  lastName:  string | null
  photoUrl:  string | null
}

interface AuthState {
  user:       AuthUser | null
  isLoaded:   boolean   // Clerk terminó de cargar
  isSignedIn: boolean

  setUser:     (user: AuthUser | null) => void
  updateUser:  (partial: Partial<AuthUser>) => void
  setLoaded:   (v: boolean) => void
  setSignedIn: (v: boolean) => void
  clear:       () => void
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
}))
