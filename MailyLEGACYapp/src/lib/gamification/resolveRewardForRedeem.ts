import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import { isCatalogCouponId } from '@constants/couponImages'
import type { RewardProduct } from '@hooks/useGamification'

type RewardsPage = { results: RewardProduct[]; count: number }

function normalizeRewards(data: RewardsPage | RewardProduct[]): RewardsPage {
  if (Array.isArray(data)) {
    return { results: data, count: data.length }
  }
  return { results: data.results ?? [], count: data.count ?? data.results?.length ?? 0 }
}

/** Obtiene el UUID real del servidor antes de canjear (dispara auto-seed en backend nuevo). */
export async function resolveRewardForRedeem(
  item: RewardProduct,
): Promise<{ reward_id?: string; points_cost?: number }> {
  if (!isCatalogCouponId(item.id)) {
    return { reward_id: item.id }
  }

  const page = normalizeRewards(
    await get<RewardsPage | RewardProduct[]>(EP.gamificationRewards),
  )

  const match = page.results.find((r) => r.points_cost === item.points_cost)
  if (match && !isCatalogCouponId(match.id)) {
    return { reward_id: match.id }
  }

  return { points_cost: item.points_cost }
}
