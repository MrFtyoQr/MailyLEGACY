export type LevelCelebrationDecision =
  | { action: 'init'; level: number }
  | { action: 'celebrate'; level: number }
  | { action: 'noop' }

/**
 * Lógica pura del watcher de subida de nivel (testeable sin AsyncStorage).
 */
export function decideLevelCelebration(
  currentLevel: number,
  stored: string | null,
): LevelCelebrationDecision {
  if (!Number.isFinite(currentLevel) || currentLevel < 1) {
    return { action: 'noop' }
  }

  if (stored === null) {
    return { action: 'init', level: currentLevel }
  }

  const lastSeen = parseInt(stored, 10)
  if (!Number.isFinite(lastSeen)) {
    return { action: 'init', level: currentLevel }
  }

  if (currentLevel > lastSeen) {
    return { action: 'celebrate', level: currentLevel }
  }

  return { action: 'noop' }
}

/** Fechas de ejemplo para el laboratorio de preview. */
export const PREVIEW_EARNED_DATES = {
  today:     () => new Date().toISOString(),
  yesterday: () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString()
  },
  lastWeek: () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  },
} as const
