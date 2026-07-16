/**
 * Canje local de cupones — sin catálogo ni POST /redeem/ en el backend.
 * El saldo del servidor (balance) no se modifica; se descuenta solo en la app
 * registrando canjes en AsyncStorage por usuario.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import {
  COUPON_CATALOG,
  CATALOG_COUPON_PREFIX,
} from '@constants/couponImages'
import type { RedeemResponse, RewardProduct } from '@hooks/useGamification'
import { ApiError } from '@lib/api/errors'

const STORAGE_PREFIX = '@maily_local_coupon_redemptions:'

export interface LocalCouponRedemption {
  id:           string
  code:         string
  reward_name:  string
  points_cost:  number
  points_spent: number
  created_at:   string
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function generateRedemptionCode(): string {
  const bytes = Crypto.getRandomBytes(4)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return `RDM-${hex}`
}

export function buildLocalCouponCatalog(): RewardProduct[] {
  return Object.entries(COUPON_CATALOG)
    .map(([cost, meta]) => {
      const pointsCost = Number(cost)
      return {
        id:          `${CATALOG_COUPON_PREFIX}${pointsCost}`,
        name:        `Cupón ${pointsCost / 100}% OFF`,
        description: meta.subtitle,
        image_url:   '',
        points_cost: pointsCost,
        stock:       1,
        is_active:   true,
      }
    })
    .sort((a, b) => a.points_cost - b.points_cost)
}

export function getRedeemedCouponCosts(
  redemptions: LocalCouponRedemption[],
): Set<number> {
  return new Set(redemptions.map((r) => r.points_cost))
}

/** Cupones predeterminados que el usuario aún no ha canjeado. */
export function filterAvailableLocalCoupons(
  redemptions: LocalCouponRedemption[],
): RewardProduct[] {
  const redeemed = getRedeemedCouponCosts(redemptions)
  return buildLocalCouponCatalog().filter((c) => !redeemed.has(c.points_cost))
}

export async function getAvailableLocalCoupons(userId: string): Promise<RewardProduct[]> {
  const redemptions = await getLocalRedemptions(userId)
  return filterAvailableLocalCoupons(redemptions)
}

export function hasRedeemedLocalCoupon(
  redemptions: LocalCouponRedemption[],
  pointsCost: number,
): boolean {
  return redemptions.some((r) => r.points_cost === pointsCost)
}

export async function getLocalRedemptions(userId: string): Promise<LocalCouponRedemption[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as LocalCouponRedemption[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getLocalRedemptionSpent(userId: string): Promise<number> {
  const list = await getLocalRedemptions(userId)
  return list.reduce((sum, r) => sum + r.points_spent, 0)
}

export function computeEffectiveBalance(serverBalance: number, localSpent: number): number {
  return Math.max(0, serverBalance - localSpent)
}

export async function redeemLocalCoupon(
  userId: string,
  item: RewardProduct,
  serverBalance: number,
): Promise<RedeemResponse> {
  const list = await getLocalRedemptions(userId)

  if (hasRedeemedLocalCoupon(list, item.points_cost)) {
    throw new ApiError(409, 'Ya canjeaste este cupón.', {
      code:   'reward_unavailable',
      detail: 'Solo puedes canjear cada cupón una vez.',
    })
  }

  const spent = list.reduce((sum, r) => sum + r.points_spent, 0)
  const effective = computeEffectiveBalance(serverBalance, spent)

  if (effective < item.points_cost) {
    throw new ApiError(400, 'Saldo insuficiente', {
      code:   'insufficient_balance',
      detail: 'No tienes puntos suficientes para este cupón.',
    })
  }

  const redemption: LocalCouponRedemption = {
    id:           Crypto.randomUUID(),
    code:         generateRedemptionCode(),
    reward_name:  item.name,
    points_cost:  item.points_cost,
    points_spent: item.points_cost,
    created_at:   new Date().toISOString(),
  }

  list.unshift(redemption)
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(list))

  const newSpent = spent + item.points_cost
  const newBalance = computeEffectiveBalance(serverBalance, newSpent)

  return {
    balance: newBalance,
    redemption: {
      id:             redemption.id,
      code:           redemption.code,
      status:         'PENDING',
      status_display: 'Pendiente de uso',
      reward:         item.id,
      reward_name:    item.name,
      reward_image:   '',
      points_spent:   redemption.points_spent,
      note:           'Canje registrado en el dispositivo',
      created_at:     redemption.created_at,
    },
  }
}
