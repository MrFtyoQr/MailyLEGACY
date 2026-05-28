/**
 * useProfile.ts
 * -------------
 * TanStack Query: obtiene el perfil del usuario autenticado.
 * GET /api/v1/auth/me/  →  { user, profile, is_complete }
 *
 * Sincroniza el resultado con el Zustand auth store.
 */

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@store/auth.store'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import type { MeResponse } from '@/types/api.types'

export function useProfile() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const setUser    = useAuthStore((s) => s.setUser)

  return useQuery<MeResponse>({
    queryKey: ['auth', 'me'],
    enabled:  isSignedIn,
    staleTime: 5 * 60 * 1000,  // 5 min
    queryFn: async () => {
      const data = await get<MeResponse>(EP.authMe)
      // Sync con Zustand
      setUser({
        id:        data.user.id,
        email:     data.user.email,
        role:      data.user.role ?? null,
        firstName: (data.profile as { first_name?: string } | null)?.first_name ?? null,
        lastName:  (data.profile as { last_name?: string }  | null)?.last_name  ?? null,
        photoUrl:  (data.profile as { photo_url?: string }  | null)?.photo_url  ?? null,
      })
      return data
    },
  })
}
