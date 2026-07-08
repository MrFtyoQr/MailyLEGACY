import React from 'react'
import { View, StyleSheet, type ViewStyle } from 'react-native'
import { DuoDepth } from '@constants/duoTheme'

export const LOGO = require('../../../assets/images/logo.png')
/** Ancho máximo de tarjeta de celebración; los modales ajustan con useWindowDimensions si hace falta. */
export const CARD_W = 360
export const CELEBRATION_DEPTH = DuoDepth.md

export function Card3D({
  faceColor,
  shadowColor,
  radius = 20,
  style,
  children,
}: {
  faceColor:   string
  shadowColor: string
  radius?:     number
  style?:      ViewStyle
  children:    React.ReactNode
}) {
  return (
    <View style={[card3d.wrap, { marginBottom: CELEBRATION_DEPTH }, style]}>
      <View
        style={[
          card3d.shadow,
          { top: CELEBRATION_DEPTH, borderRadius: radius, backgroundColor: shadowColor },
        ]}
      />
      <View
        style={[
          card3d.face,
          { borderRadius: radius, backgroundColor: faceColor, marginBottom: CELEBRATION_DEPTH },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

export function DiagonalSplitBackground({ light, dark }: { light: string; dark: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: light }]} />
      <View style={split.wedgeWrap}>
        <View style={[split.wedge, { backgroundColor: dark }]} />
      </View>
    </View>
  )
}

const card3d = StyleSheet.create({
  wrap:   { position: 'relative' },
  shadow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face:   { overflow: 'hidden' },
})

const split = StyleSheet.create({
  wedgeWrap: {
    position: 'absolute',
    left:     0,
    bottom:   0,
    width:    '100%',
    height:   '58%',
    overflow: 'hidden',
  },
  wedge: {
    position:        'absolute',
    left:            '-8%',
    bottom:          '-22%',
    width:           '135%',
    height:          '95%',
    transform:       [{ rotate: '-17deg' }],
  },
})
