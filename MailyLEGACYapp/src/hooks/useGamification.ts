import { useQuery } from '@tanstack/react-query'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Badge {
  id:               string
  code:             string
  name:             string
  description:      string
  category:         string
  category_display: string
  icon_url:         string
  threshold:        number
  points_reward:    number
}

export interface EarnedBadge {
  id:        string
  badge:     Badge
  earned_at: string
}

export interface PlayerProfile {
  id:                 string
  total_points:       number
  level:              number
  current_streak:     number
  longest_streak:     number
  last_activity_date: string | null
  multiplier:         number
  badges:             EarnedBadge[]
  created_at:         string
  updated_at:         string
}

export interface PointTransaction {
  id:             string
  source:         string
  source_display: string
  base_points:    number
  multiplier:     number
  points:         number
  note:           string
  created_at:     string
}

export interface RewardProduct {
  id:          string
  name:        string
  description: string
  image_url:   string
  points_cost: number
  stock:       number
  is_active:   boolean
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePlayerProfile() {
  return useQuery<PlayerProfile>({
    queryKey: ['player-profile'],
    queryFn:  () => get(EP.gamification),
    staleTime: 60_000,
  })
}

export function useTransactions() {
  return useQuery<{ results: PointTransaction[]; count: number }>({
    queryKey: ['gamification-transactions'],
    queryFn:  () => get(EP.gamificationTransactions),
    staleTime: 30_000,
  })
}

export function useAvailableBadges() {
  return useQuery<{ results: Badge[]; count: number }>({
    queryKey: ['badges'],
    queryFn:  () => get(EP.badges),
    staleTime: 5 * 60_000,
  })
}

export function useRewardProducts() {
  return useQuery<{ results: RewardProduct[]; count: number }>({
    queryKey: ['reward-products'],
    queryFn:  () => get(EP.gamificationRewards),
    staleTime: 5 * 60_000,
  })
}
