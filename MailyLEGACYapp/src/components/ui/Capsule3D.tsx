/**
 * Capsule3D.tsx
 * -------------
 * Contenedor base con efecto 3D plano estilo Duolingo.
 * Capa inferior sólida + cara que se desplaza al presionar.
 */

import React, { useState } from 'react'
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native'
import { DuoDepth } from '@constants/duoTheme'

type DepthSize = keyof typeof DuoDepth

interface Capsule3DProps {
  children:       React.ReactNode
  faceColor?:     string
  shadowColor?:   string
  depth?:         DepthSize
  borderRadius?:  number
  /** Si true, la cara responde al press (botones, cards táctiles) */
  pressable?:     boolean
  onPress?:       () => void
  disabled?:      boolean
  style?:         StyleProp<ViewStyle>
  faceStyle?:     StyleProp<ViewStyle>
}

export function Capsule3D({
  children,
  faceColor    = '#FFFFFF',
  shadowColor  = '#E2E8F0',
  depth        = 'md',
  borderRadius = 16,
  pressable    = false,
  onPress,
  disabled     = false,
  style,
  faceStyle,
}: Capsule3DProps) {
  const [pressed, setPressed] = useState(false)
  const d = DuoDepth[depth]
  const offset = pressable && pressed ? d : 0

  const inner = (
    <View style={[styles.wrap, { marginBottom: d }, style]}>
      <View
        style={[
          styles.shadow,
          {
            top:           d,
            borderRadius,
            backgroundColor: shadowColor,
          },
        ]}
      />
      <View
        style={[
          styles.face,
          {
            borderRadius,
            backgroundColor: faceColor,
            marginBottom:    d - offset,
            transform:       [{ translateY: offset }],
          },
          faceStyle,
        ]}
      >
        {children}
      </View>
    </View>
  )

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={({ pressed: p }) => [disabled && styles.disabled]}
      >
        {inner}
      </Pressable>
    )
  }

  return inner
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    left:     0,
    right:    0,
    bottom:   0,
  },
  face: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.55,
  },
})
