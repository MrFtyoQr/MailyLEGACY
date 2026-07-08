/**
 * Escucha cambios de nivel del jugador y muestra la celebración globalmente.
 */

import React from 'react'
import { usePlayerProfile } from '@hooks/useGamification'
import { useLevelUpCelebration } from '@hooks/useLevelUpCelebration'
import { LevelUpModal } from '@components/gamification/LevelUpModal'
import { useAuthStore } from '@store/auth.store'

export function LevelUpWatcher() {
  const { data: profile } = usePlayerProfile()
  const firstName = useAuthStore((s) => s.user?.firstName)
  const { celebration, dismissCelebration } = useLevelUpCelebration(profile?.level)

  if (celebration == null) return null

  return (
    <LevelUpModal
      level={celebration.level}
      earnedAt={celebration.earnedAt}
      firstName={firstName}
      visible
      onClose={dismissCelebration}
    />
  )
}
