/**
 * Escucha nuevas insignias de logro y muestra la celebración compartible.
 */

import React from 'react'
import { usePlayerProfile } from '@hooks/useGamification'
import { useBadgeUnlockCelebration } from '@hooks/useBadgeUnlockCelebration'
import { BadgeUnlockedModal } from '@components/gamification/BadgeUnlockedModal'
import { useAuthStore } from '@store/auth.store'

export function BadgeUnlockWatcher() {
  const { data: profile } = usePlayerProfile()
  const firstName = useAuthStore((s) => s.user?.firstName)
  const { celebration, dismissCelebration } = useBadgeUnlockCelebration(profile?.badges)

  if (celebration == null) return null

  return (
    <BadgeUnlockedModal
      badge={celebration}
      firstName={firstName}
      visible
      onClose={dismissCelebration}
    />
  )
}
