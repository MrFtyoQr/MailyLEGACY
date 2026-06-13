import React from 'react'
import { View, StyleSheet, type ViewProps } from 'react-native'
import { Colors } from '@constants/colors'
import { DuoColors, DuoDepth } from '@constants/duoTheme'

interface CardProps extends ViewProps {
  variant?:  'default' | 'elevated' | 'outlined'
  padding?:  number
  /** Color de la cara (default blanco) */
  faceColor?: string
  /** Color de la sombra 3D inferior */
  shadowColor?: string
}

export function Card({
  variant     = 'default',
  padding     = 16,
  faceColor,
  shadowColor,
  style,
  children,
  ...rest
}: CardProps) {
  const face   = faceColor   ?? DuoColors.card.face
  const shadow = shadowColor ?? DuoColors.card.shadow
  const d      = variant === 'outlined' ? DuoDepth.sm : DuoDepth.md

  if (variant === 'outlined') {
    return (
      <View style={[styles.wrap, { marginBottom: d }, style]} {...rest}>
        <View
          style={[
            styles.shadow,
            { top: d, borderRadius: 16, backgroundColor: shadow },
          ]}
        />
        <View
          style={[
            styles.face,
            styles.outlined,
            { padding, borderRadius: 16, backgroundColor: face, marginBottom: d },
          ]}
        >
          {children}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.wrap, { marginBottom: d }, style]} {...rest}>
      <View
        style={[
          styles.shadow,
          {
            top: d,
            borderRadius: 16,
            backgroundColor: variant === 'elevated' ? '#CBD5E1' : shadow,
          },
        ]}
      />
      <View
        style={[
          styles.face,
          { padding, borderRadius: 16, backgroundColor: face, marginBottom: d },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:   { position: 'relative' },
  shadow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face:   { overflow: 'hidden' },
  outlined: {
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
})
