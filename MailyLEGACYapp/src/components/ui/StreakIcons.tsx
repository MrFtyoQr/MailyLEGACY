/**
 * StreakIcons.tsx — iconos de racha actual (llama) y racha récord (trofeo).
 */

import React from 'react'
import { View, Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native'

const FLAME  = require('../../../assets/images/streak-flame.png')
const TROPHY = require('../../../assets/images/streak-trophy.png')

/** Misma huella que IconBadge con size=20 (20 + 20) */
export const STREAK_ICON_SLOT = 40

interface StreakIconProps {
  size?: number
  style?: StyleProp<ImageStyle>
}

function StreakImage({ source, size = 20, style }: { source: number; size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={source}
      style={[styles.icon, { width: size, height: size }, style]}
      resizeMode="contain"
    />
  )
}

export function StreakFlame({ size = 20, style }: StreakIconProps) {
  return <StreakImage source={FLAME} size={size} style={style} />
}

export function StreakTrophy({ size = 20, style }: StreakIconProps) {
  return <StreakImage source={TROPHY} size={size} style={style} />
}

/** Contenedor fijo para alinear tarjetas del dashboard */
export function StreakIconSlot({
  children,
  dim = STREAK_ICON_SLOT,
}: {
  children: React.ReactNode
  dim?: number
}) {
  return (
    <View style={[styles.slot, { width: dim, height: dim }]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  icon: { aspectRatio: 1 },
  slot: {
    alignItems:     'center',
    justifyContent: 'center',
  },
})
