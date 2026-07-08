export interface BadgeCelebrationPayload {
  code:     string
  name:     string
  reason:   string
  category: string
  earnedAt: string
}

export function parseSeenBadgeCodes(stored: string | null): Set<string> | null {
  if (stored === null) return null
  try {
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((c): c is string => typeof c === 'string'))
  } catch {
    return new Set()
  }
}

export function findNewBadgeCelebrations(
  earned: BadgeCelebrationPayload[],
  seen: Set<string> | null,
): { init: boolean; celebrations: BadgeCelebrationPayload[] } {
  if (seen === null) {
    return { init: true, celebrations: [] }
  }

  const celebrations = earned
    .filter((b) => !seen.has(b.code))
    .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt))

  return { init: false, celebrations }
}
