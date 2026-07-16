import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import { ApiError } from '@lib/api/errors'
import { LOCAL_COUPONS_ENABLED } from '@constants/config'
import { useAuthStore } from '@store/auth.store'
import {
  buildLocalCouponCatalog,
  getAvailableLocalCoupons,
  getLocalRedemptions,
  redeemLocalCoupon,
  computeEffectiveBalance,
} from '@lib/gamification/localCoupons'
import { normalizePlayerProfile } from '@lib/gamification/normalizePlayerProfile'
import { setLastKnownProfile } from '@lib/gamification/playerProfileTracker'
import { resolveRewardForRedeem } from '@lib/gamification/resolveRewardForRedeem'

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
  id:                    string
  total_points:          number
  balance:               number
  level:                 number
  level_points:          number
  level_points_required: number
  current_streak:        number
  longest_streak:        number
  last_activity_date:    string | null
  multiplier:            number
  badges:                EarnedBadge[]
  created_at:            string
  updated_at:            string
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

export interface RedemptionRecord {
  id:             string
  code:           string
  status:         string
  status_display: string
  reward:         string
  reward_name:    string
  reward_image:   string
  points_spent:   number
  note:           string
  created_at:     string
}

export interface RedeemResponse {
  redemption: RedemptionRecord
  balance:    number
}

type Paginated<T> = { results: T[]; count: number }

function normalizePaginated<T>(data: Paginated<T> | T[]): Paginated<T> {
  if (Array.isArray(data)) {
    return { results: data, count: data.length }
  }
  return {
    results: data.results ?? [],
    count:   data.count ?? data.results?.length ?? 0,
  }
}

async function fetchRewardProducts(userId?: string | null): Promise<Paginated<RewardProduct>> {
  const fallback = buildLocalCouponCatalog()
  if (LOCAL_COUPONS_ENABLED) {
    const results = userId
      ? await getAvailableLocalCoupons(userId)
      : fallback
    return { results, count: results.length }
  }
  try {
    const data = await get<Paginated<RewardProduct> | RewardProduct[]>(EP.gamificationRewards)
    const page = normalizePaginated(data)
    const merged = fallback.map((fb) => {
      const fromApi = page.results.find((r) => r.points_cost === fb.points_cost)
      return fromApi ?? fb
    })
    return { results: merged, count: merged.length }
  } catch {
    return { results: fallback, count: fallback.length }
  }
}

export { fetchRewardProducts }

export async function fetchPlayerProfile(): Promise<PlayerProfile> {
  const data = await get<PlayerProfile>(EP.gamification)
  const profile = normalizePlayerProfile(data)
  setLastKnownProfile(profile)
  return profile
}

export async function refetchPlayerProfile(qc: ReturnType<typeof useQueryClient>) {
  const { refreshProfileAndCelebrate } = await import('@lib/gamification/refreshProfileAndCelebrate')
  return refreshProfileAndCelebrate(qc)
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePlayerProfile() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  return useQuery<PlayerProfile>({
    queryKey: ['player-profile'],
    queryFn:  fetchPlayerProfile,
    enabled:  isSignedIn,
    staleTime: 5_000,
    refetchOnMount: 'always',
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
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  return useQuery<{ results: Badge[]; count: number }>({
    queryKey: ['badges'],
    queryFn:  () => get(EP.badges),
    enabled:  isSignedIn,
    staleTime: 5 * 60_000,
  })
}

export function useRewardProducts() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const userId     = useAuthStore((s) => s.user?.id)
  return useQuery<Paginated<RewardProduct>>({
    queryKey: ['reward-products', userId ?? 'guest'],
    queryFn:  () => fetchRewardProducts(userId),
    enabled:  isSignedIn,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useLocalCouponRedemptions() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['local-coupon-redemptions', userId],
    queryFn:  () => (userId ? getLocalRedemptions(userId) : []),
    enabled:  LOCAL_COUPONS_ENABLED && !!userId,
    staleTime: 0,
  })
}

/** Saldo canjeable visible = balance del servidor − canjes locales en este dispositivo. */
export function useEffectiveRedeemableBalance(serverBalance: number | undefined) {
  const userId = useAuthStore((s) => s.user?.id)
  const { data: localList } = useLocalCouponRedemptions()
  if (!LOCAL_COUPONS_ENABLED || !userId) {
    return serverBalance ?? 0
  }
  const spent = localList?.reduce((sum, r) => sum + r.points_spent, 0) ?? 0
  return computeEffectiveBalance(serverBalance ?? 0, spent)
}

export function useRedeemReward() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  return useMutation({
    mutationFn: async (item: RewardProduct) => {
      if (LOCAL_COUPONS_ENABLED) {
        if (!userId) {
          throw new ApiError(401, 'Debes iniciar sesión para canjear.')
        }
        const profile = qc.getQueryData<PlayerProfile>(['player-profile'])
        const serverBalance = profile?.balance ?? 0
        return redeemLocalCoupon(userId, item, serverBalance)
      }

      const resolved = await resolveRewardForRedeem(item)
      const body: Record<string, string | number> = {}
      if (resolved.reward_id) body.reward_id = resolved.reward_id
      if (resolved.points_cost != null) body.points_cost = resolved.points_cost
      if (!body.reward_id && body.points_cost == null) {
        throw new ApiError(400, 'No se pudo identificar el cupón en el servidor.')
      }
      return post<RedeemResponse>(EP.gamificationRedeem, body)
    },
    onSuccess: async () => {
      await Promise.all([
        qc.fetchQuery({ queryKey: ['player-profile'], queryFn: fetchPlayerProfile }),
        qc.fetchQuery({ queryKey: ['reward-products', userId ?? 'guest'], queryFn: () => fetchRewardProducts(userId) }),
        qc.invalidateQueries({ queryKey: ['gamification-transactions'] }),
        qc.invalidateQueries({ queryKey: ['local-coupon-redemptions'] }),
      ])
    },
  })
}

/** Mensaje amigable para errores del endpoint de canje. */
export function redeemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const raw = error.raw as { code?: string; detail?: string } | undefined
    switch (raw?.code) {
      case 'insufficient_balance':
        return 'No tienes puntos suficientes para este cupón.'
      case 'reward_unavailable':
        return raw.detail ?? 'Este cupón ya no está disponible o ya lo canjeaste.'
      case 'reward_not_found':
        return 'El cupón no existe o fue retirado del catálogo.'
      case 'reward_id_required':
        return 'El servidor aún no tiene el catálogo de cupones configurado. Pide que desplieguen la última versión del backend.'
      default:
        return raw?.detail ?? error.detail
    }
  }
  return 'No se pudo completar el canje. Intenta de nuevo.'
}
