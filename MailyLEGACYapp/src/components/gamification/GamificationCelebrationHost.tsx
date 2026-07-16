/**
 * Modales globales de gamificación — montado en el root layout para que
 * siempre queden por encima de tabs y navegación.
 */

import React, { useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LAST_SEEN_BADGE_CODES_KEY } from '@constants/badgeImages'
import { LAST_SEEN_LEVEL_KEY } from '@constants/levelBadges'
import { parseSeenBadgeCodes } from '@lib/gamification/badgeCelebrationLogic'
import { BadgeUnlockedModal } from '@components/gamification/BadgeUnlockedModal'
import { LevelUpModal } from '@components/gamification/LevelUpModal'
import { useGamificationCelebrations } from '@hooks/useGamificationCelebrations'
import { useGamificationStore } from '@store/gamification.store'
import { useAuthStore } from '@store/auth.store'

export function GamificationCelebrationHost() {
  const role       = useAuthStore((s) => s.user?.role)
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const firstName  = useAuthStore((s) => s.user?.firstName)

  const badgeQueue       = useGamificationStore((s) => s.badgeQueue)
  const levelCelebration = useGamificationStore((s) => s.levelCelebration)
  const dequeueBadge     = useGamificationStore((s) => s.dequeueBadge)
  const clearLevelUp     = useGamificationStore((s) => s.clearLevelUp)

  useGamificationCelebrations()

  const currentBadge = badgeQueue[0] ?? null
  const showLevel    = levelCelebration != null && currentBadge == null

  const dismissBadge = useCallback(async () => {
    if (!currentBadge) return
    const stored = await AsyncStorage.getItem(LAST_SEEN_BADGE_CODES_KEY)
    const seen = parseSeenBadgeCodes(stored) ?? new Set<string>()
    seen.add(currentBadge.code)
    await AsyncStorage.setItem(LAST_SEEN_BADGE_CODES_KEY, JSON.stringify([...seen]))
    dequeueBadge()
  }, [currentBadge, dequeueBadge])

  const dismissLevel = useCallback(async () => {
    if (levelCelebration) {
      await AsyncStorage.setItem(LAST_SEEN_LEVEL_KEY, String(levelCelebration.level))
    }
    clearLevelUp()
  }, [levelCelebration, clearLevelUp])

  if (!isSignedIn) return null

  // Paciente: role explícito o aún no cargado desde /auth/me/ (sesión con token).
  const canCelebrate = role == null || role === 'PATIENT'
  if (!canCelebrate) return null

  return (
    <>
      {currentBadge ? (
        <BadgeUnlockedModal
          badge={currentBadge}
          firstName={firstName}
          visible
          onClose={dismissBadge}
        />
      ) : null}

      {showLevel && levelCelebration ? (
        <LevelUpModal
          level={levelCelebration.level}
          earnedAt={levelCelebration.earnedAt}
          firstName={firstName}
          visible
          onClose={dismissLevel}
        />
      ) : null}
    </>
  )
}
