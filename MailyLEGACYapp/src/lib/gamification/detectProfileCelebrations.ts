import type { PlayerProfile } from '@hooks/useGamification'
import type { BadgeCelebrationPayload } from '@lib/gamification/badgeCelebrationLogic'
import { badgeToCelebration } from '@lib/gamification/normalizePlayerProfile'

export interface ProfileCelebrationDelta {
  levelUp:  number | null
  badges:   BadgeCelebrationPayload[]
}

/** Compara dos perfiles y devuelve celebraciones pendientes. */
export function detectProfileCelebrations(
  prev: PlayerProfile,
  next: PlayerProfile,
): ProfileCelebrationDelta {
  const prevCodes = new Set(prev.badges.map((b) => b.badge.code))

  const badges = next.badges
    .filter((b) => !prevCodes.has(b.badge.code))
    .map(badgeToCelebration)
    .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt))

  const levelUp = next.level > prev.level ? next.level : null

  return { levelUp, badges }
}
