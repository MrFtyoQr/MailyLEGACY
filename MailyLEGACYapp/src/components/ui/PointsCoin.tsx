/**
 * PointsCoin.tsx — moneda Cuida para representar puntos acumulados y ganados.
 */

import React from 'react'
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native'

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

const styles = StyleSheet.create({
  coin: { aspectRatio: 1 },
})
