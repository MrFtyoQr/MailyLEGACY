/**
 * Detecta insignias nuevas y subidas de nivel al abrir la app (AsyncStorage).
 * Los logros en sesión se disparan desde las mutaciones (medicamento, vitales).
 */

import { useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LAST_SEEN_BADGE_CODES_KEY } from '@constants/badgeImages'
import { LAST_SEEN_LEVEL_KEY } from '@constants/levelBadges'
import { parseSeenBadgeCodes } from '@lib/gamification/badgeCelebrationLogic'
import { badgeToCelebration } from '@lib/gamification/normalizePlayerProfile'
import { usePlayerProfile } from '@hooks/useGamification'
import { useGamificationStore } from '@store/gamification.store'
import { useAuthStore } from '@store/auth.store'

function isPatientUser(role: string | null | undefined): boolean {
  return role == null || role === 'PATIENT'
}

export function useGamificationCelebrations() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const role       = useAuthStore((s) => s.user?.role)
  const { data: profile, isSuccess } = usePlayerProfile()

  const enqueueBadges = useGamificationStore((s) => s.enqueueBadges)
  const showLevelUp   = useGamificationStore((s) => s.showLevelUp)

  const crossSessionDone = useRef(false)

  useEffect(() => {
    if (!isSignedIn || !isPatientUser(role) || !isSuccess || !profile) return
    if (crossSessionDone.current) return

    crossSessionDone.current = true
    let cancelled = false

    async function checkCrossSession() {
      const [storedLevel, storedBadgesRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_SEEN_LEVEL_KEY),
        AsyncStorage.getItem(LAST_SEEN_BADGE_CODES_KEY),
      ])
      if (cancelled) return

      const seenBadges = parseSeenBadgeCodes(storedBadgesRaw)

      if (storedLevel === null || seenBadges === null) {
        await Promise.all([
          AsyncStorage.setItem(LAST_SEEN_LEVEL_KEY, String(profile!.level)),
          AsyncStorage.setItem(
            LAST_SEEN_BADGE_CODES_KEY,
            JSON.stringify(profile!.badges.map((b) => b.badge.code)),
          ),
        ])
        return
      }

      const lastLevel = parseInt(storedLevel, 10)
      if (Number.isFinite(lastLevel) && profile!.level > lastLevel) {
        showLevelUp(profile!.level)
      }

      const freshBadges = profile!.badges
        .filter((b) => !seenBadges.has(b.badge.code))
        .map(badgeToCelebration)
        .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt))

      if (freshBadges.length > 0) {
        enqueueBadges(freshBadges)
      }
    }

    checkCrossSession()
    return () => { cancelled = true }
  }, [isSignedIn, role, isSuccess, profile, enqueueBadges, showLevelUp])
}
