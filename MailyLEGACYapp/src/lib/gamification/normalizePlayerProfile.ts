import type { EarnedBadge, PlayerProfile } from '@hooks/useGamification'
import { getLevelProgressFromProfile } from '@constants/levelBadgeData'

export function normalizePlayerProfile(raw: PlayerProfile): PlayerProfile {
  const badges = Array.isArray(raw.badges) ? raw.badges : []
  const balance = typeof raw.balance === 'number'
    ? raw.balance
    : (raw.total_points ?? 0)
  const level = typeof raw.level === 'number' && raw.level >= 1 ? raw.level : 1
  const progress = getLevelProgressFromProfile({
    total_points:          raw.total_points ?? 0,
    level,
    level_points:          raw.level_points,
    level_points_required: raw.level_points_required,
  })

  return {
    ...raw,
    badges,
    balance,
    level,
    level_points:          progress.current,
    level_points_required: progress.required,
  }
}

export function badgeToCelebration(eb: EarnedBadge) {
  return {
    code:     eb.badge.code,
    name:     eb.badge.name,
    reason:   eb.badge.description,
    category: eb.badge.category,
    earnedAt: eb.earned_at,
  }
}

export function profileSnapshot(profile: PlayerProfile) {
  return JSON.stringify({
    level:  profile.level,
    badges: profile.badges.map((b) => b.badge.code).sort(),
  })
}
