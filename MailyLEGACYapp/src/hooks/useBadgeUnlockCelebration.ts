import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LAST_SEEN_BADGE_CODES_KEY } from '@constants/badgeImages'
import {
  findNewBadgeCelebrations,
  parseSeenBadgeCodes,
  type BadgeCelebrationPayload,
} from '@lib/gamification/badgeCelebrationLogic'
import type { EarnedBadge } from '@hooks/useGamification'

function toCelebrationPayload(eb: EarnedBadge): BadgeCelebrationPayload {
  return {
    code:     eb.badge.code,
    name:     eb.badge.name,
    reason:   eb.badge.description,
    category: eb.badge.category,
    earnedAt: eb.earned_at,
  }
}

export function useBadgeUnlockCelebration(earnedBadges: EarnedBadge[] | undefined) {
  const [queue, setQueue] = useState<BadgeCelebrationPayload[]>([])
  const current = queue[0] ?? null
  /** Evita condición de carrera: init en AsyncStorage es async. */
  const seenCacheRef = useRef<Set<string> | null>(null)

  const payloads = useMemo(
    () => (earnedBadges ?? []).map(toCelebrationPayload),
    [earnedBadges],
  )

  useEffect(() => {
    if (earnedBadges == null) return

    let cancelled = false

    async function sync() {
      const stored = await AsyncStorage.getItem(LAST_SEEN_BADGE_CODES_KEY)
      if (cancelled) return

      let seen = seenCacheRef.current ?? parseSeenBadgeCodes(stored)
      const { init, celebrations } = findNewBadgeCelebrations(payloads, seen)

      if (init) {
        seen = new Set(payloads.map((p) => p.code))
        seenCacheRef.current = seen
        await AsyncStorage.setItem(
          LAST_SEEN_BADGE_CODES_KEY,
          JSON.stringify([...seen]),
        )
        return
      }

      seenCacheRef.current = seen

      if (celebrations.length > 0) {
        setQueue((prev) => {
          const pending = new Set(prev.map((p) => p.code))
          const fresh = celebrations.filter((c) => !pending.has(c.code))
          return fresh.length > 0 ? [...prev, ...fresh] : prev
        })
      }
    }

    sync()
    return () => { cancelled = true }
  }, [earnedBadges, payloads])

  const dismissCelebration = useCallback(async () => {
    if (!current) return

    const stored = await AsyncStorage.getItem(LAST_SEEN_BADGE_CODES_KEY)
    const seen = seenCacheRef.current ?? parseSeenBadgeCodes(stored) ?? new Set<string>()
    seen.add(current.code)
    seenCacheRef.current = seen
    await AsyncStorage.setItem(LAST_SEEN_BADGE_CODES_KEY, JSON.stringify([...seen]))

    setQueue((prev) => prev.slice(1))
  }, [current])

  return { celebration: current, dismissCelebration }
}
