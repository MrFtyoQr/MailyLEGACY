import type { PlayerProfile } from '@hooks/useGamification'
import { detectProfileCelebrations } from '@lib/gamification/detectProfileCelebrations'
import { useGamificationStore } from '@store/gamification.store'

/** Dispara modales de insignia / nivel tras un cambio real de perfil. */
export function applyProfileCelebrations(
  prev: PlayerProfile | undefined,
  next: PlayerProfile,
) {
  if (!prev || prev.id !== next.id) return

  const { levelUp, badges } = detectProfileCelebrations(prev, next)
  const store = useGamificationStore.getState()

  if (badges.length > 0) {
    store.enqueueBadges(badges)
  }
  if (levelUp != null) {
    store.showLevelUp(levelUp)
  }
}
