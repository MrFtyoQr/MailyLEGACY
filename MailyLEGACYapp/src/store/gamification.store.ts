import { create } from 'zustand'
import type { BadgeCelebrationPayload } from '@lib/gamification/badgeCelebrationLogic'
import type { LevelCelebration } from '@hooks/useLevelUpCelebration'

interface GamificationCelebrationState {
  badgeQueue:       BadgeCelebrationPayload[]
  levelCelebration: LevelCelebration | null

  enqueueBadges: (badges: BadgeCelebrationPayload[]) => void
  dequeueBadge:  () => void
  showLevelUp:   (level: number, earnedAt?: string) => void
  clearLevelUp:  () => void
}

export const useGamificationStore = create<GamificationCelebrationState>((set) => ({
  badgeQueue:       [],
  levelCelebration: null,

  enqueueBadges: (badges) => set((s) => {
    if (badges.length === 0) return s
    const pending = new Set(s.badgeQueue.map((b) => b.code))
    const fresh = badges.filter((b) => !pending.has(b.code))
    return fresh.length > 0 ? { badgeQueue: [...s.badgeQueue, ...fresh] } : s
  }),

  dequeueBadge: () => set((s) => ({ badgeQueue: s.badgeQueue.slice(1) })),

  showLevelUp: (level, earnedAt) => set((s) => {
    if (s.levelCelebration?.level === level) return s
    return {
      levelCelebration: { level, earnedAt: earnedAt ?? new Date().toISOString() },
    }
  }),

  clearLevelUp: () => set({ levelCelebration: null }),
}))
