/**
 * PointsCoin.tsx — moneda Cuida para representar puntos acumulados y ganados.
 */

import React from 'react'
import { Image, View, StyleSheet, type ImageStyle, type StyleProp } from 'react-native'

const COIN = require('../../../assets/images/cuida-coin.png')

interface PointsCoinProps {
  size?: number
  style?: StyleProp<ImageStyle>
}

export function PointsCoin({ size = 20, style }: PointsCoinProps) {
  return (
    <Image
      source={COIN}
      style={[styles.coin, { width: size, height: size }, style]}
      resizeMode="contain"
    />
  )
}

/** Moneda dentro de recuadro pastel, alineado con IconBadge del menú */
export function PointsIconBadge({ size = 22 }: { size?: number }) {
  return (
    <View style={styles.badge}>
      <PointsCoin size={size} />
    </View>
  )
}

const styles = StyleSheet.create({
  coin: { aspectRatio: 1 },
  badge: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: '#FFF8EB',
    alignItems:      'center',
    justifyContent:  'center',
  },
})
