/**
 * Precarga el perfil de gamificación al entrar al flujo paciente
 * para que las celebraciones funcionen en cualquier pantalla.
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@store/auth.store'
import { fetchPlayerProfile, fetchRewardProducts } from '@hooks/useGamification'

export function PatientGamificationInit() {
  const qc     = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    let cancelled = false

    async function warmUp() {
      try {
        await qc.fetchQuery({
          queryKey: ['player-profile'],
          queryFn:  fetchPlayerProfile,
        })
        if (cancelled) return
        await qc.prefetchQuery({
          queryKey: ['reward-products', userId ?? 'guest'],
          queryFn:  () => fetchRewardProducts(userId),
        })
      } catch {
        // Sin bloquear navegación si el API falla.
      }
    }

    warmUp()
    return () => { cancelled = true }
  }, [qc, userId])

  return null
}
