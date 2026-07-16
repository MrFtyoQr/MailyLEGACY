import { useEffect, useState, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LAST_SEEN_LEVEL_KEY } from '@constants/levelBadges'
import { decideLevelCelebration } from '@lib/gamification/levelCelebrationLogic'

/**
 * Detecta cuando el jugador sube de nivel y dispara la celebración una sola vez.
 * En la primera visita guarda el nivel actual sin mostrar modal retroactivo.
 */
export interface LevelCelebration {
  level:    number
  earnedAt: string
}

export function useLevelUpCelebration(currentLevel: number | undefined) {
  const [celebration, setCelebration] = useState<LevelCelebration | null>(null)
  /** Evita condición de carrera mientras AsyncStorage persiste el init. */
  const seenLevelRef = useRef<number | null>(null)

  useEffect(() => {
    if (currentLevel == null || currentLevel < 1) return

    const level = currentLevel
    let cancelled = false

    async function sync() {
      const stored = await AsyncStorage.getItem(LAST_SEEN_LEVEL_KEY)
      if (cancelled) return

      const decision = decideLevelCelebration(level, stored)

      if (decision.action === 'init') {
        if (seenLevelRef.current != null && level > seenLevelRef.current) {
          seenLevelRef.current = level
          await AsyncStorage.setItem(LAST_SEEN_LEVEL_KEY, String(level))
          setCelebration({ level, earnedAt: new Date().toISOString() })
          return
        }
        seenLevelRef.current = decision.level
        await AsyncStorage.setItem(LAST_SEEN_LEVEL_KEY, String(decision.level))
        return
      }

      if (decision.action === 'celebrate') {
        seenLevelRef.current = decision.level
        setCelebration({ level: decision.level, earnedAt: new Date().toISOString() })
      }
    }

    sync()
    return () => { cancelled = true }
  }, [currentLevel])

  const dismissCelebration = useCallback(async () => {
    if (currentLevel != null) {
      seenLevelRef.current = currentLevel
      await AsyncStorage.setItem(LAST_SEEN_LEVEL_KEY, String(currentLevel))
    }
    setCelebration(null)
  }, [currentLevel])

  return { celebration, dismissCelebration }
}
