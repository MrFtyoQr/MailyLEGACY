import type { EarnedBadge, PlayerProfile } from '@hooks/useGamification'

export function normalizePlayerProfile(raw: PlayerProfile): PlayerProfile {
  const badges = Array.isArray(raw.badges) ? raw.badges : []
  const balance = typeof raw.balance === 'number'
    ? raw.balance
    : (raw.total_points ?? 0)

  return {
    ...raw,
    badges,
    balance,
    level: typeof raw.level === 'number' && raw.level >= 1 ? raw.level : 1,
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
