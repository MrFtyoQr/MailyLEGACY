import type { ImageSourcePropType } from 'react-native'

/** Catálogo local de cupones — sincronizado con seed_rewards.py (points_cost como clave). */
export const COUPON_CATALOG: Record<number, { image: ImageSourcePropType; subtitle: string }> = {
  500: {
    image:    require('../../assets/images/coupons/coupon-5.png'),
    subtitle: 'En productos Aledro Farmaceutic',
  },
  1000: {
    image:    require('../../assets/images/coupons/coupon-10.png'),
    subtitle: 'En tu próxima cita en Clínica CAMSA',
  },
  1500: {
    image:    require('../../assets/images/coupons/coupon-15.png'),
    subtitle: 'En productos Aledro Farmaceutic',
  },
  2000: {
    image:    require('../../assets/images/coupons/coupon-20.png'),
    subtitle: 'En tu próxima cita en Clínica CAMSA',
  },
}

export const CATALOG_COUPON_PREFIX = 'catalog-'

export function isCatalogCouponId(id: string): boolean {
  return id.startsWith(CATALOG_COUPON_PREFIX)
}

export function getCouponImage(pointsCost: number): ImageSourcePropType | null {
  return COUPON_CATALOG[pointsCost]?.image ?? null
}

export function getCouponSubtitle(pointsCost: number): string | null {
  return COUPON_CATALOG[pointsCost]?.subtitle ?? null
}
