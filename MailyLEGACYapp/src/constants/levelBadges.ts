import type { ImageSourcePropType } from 'react-native'
import {
  MAX_LEVEL,
  LEVEL_THRESHOLDS,
  LEVEL_META_TEXT,
  clampLevel,
  getLevelProgress,
  LAST_SEEN_LEVEL_KEY,
  type LevelMetaText,
} from './levelBadgeData'

export {
  MAX_LEVEL,
  LEVEL_THRESHOLDS,
  getLevelProgress,
  LAST_SEEN_LEVEL_KEY,
}

export interface LevelMeta extends LevelMetaText {
  image: ImageSourcePropType
}

const LEVEL_IMAGES: Record<number, ImageSourcePropType> = {
  1:  require('../../assets/images/levels/nivel-1.png'),
  2:  require('../../assets/images/levels/nivel-2.png'),
  3:  require('../../assets/images/levels/nivel-3.png'),
  4:  require('../../assets/images/levels/nivel-4.png'),
  5:  require('../../assets/images/levels/nivel-5.png'),
  6:  require('../../assets/images/levels/nivel-6.png'),
  7:  require('../../assets/images/levels/nivel-7.png'),
  8:  require('../../assets/images/levels/nivel-8.png'),
  9:  require('../../assets/images/levels/nivel-9.png'),
  10: require('../../assets/images/levels/nivel-10.png'),
}

export const LEVEL_META: Record<number, LevelMeta> = Object.fromEntries(
  Object.entries(LEVEL_META_TEXT).map(([level, meta]) => [
    level,
    { ...meta, image: LEVEL_IMAGES[Number(level)] },
  ]),
) as Record<number, LevelMeta>

export function getLevelMeta(level: number): LevelMeta {
  return LEVEL_META[clampLevel(level)]
}
