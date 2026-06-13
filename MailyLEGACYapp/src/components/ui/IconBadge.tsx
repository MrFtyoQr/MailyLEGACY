/**
 * IconBadge.tsx
 * -------------
 * Icono vectorial dentro de un círculo/cuadrado con fondo tintado
 * y color semántico según el tipo de contenido.
 */

import React from 'react'
import { View, StyleSheet, type ViewStyle } from 'react-native'
import { AppIcon, type AppIconName } from './AppIcon'
import { getIconColors, colorsFromAccent, type IconColorSet } from '@constants/iconColors'

interface IconBadgeProps {
  name:       AppIconName
  size?:      number
  /** Override del color del icono */
  color?:     string
  /** Override del fondo del badge */
  bgColor?:   string
  /** Usar color de acento dinámico (ej. adherencia) */
  accent?:    string
  shape?:     'circle' | 'rounded'
  style?:     ViewStyle
}

export function IconBadge({
  name,
  size     = 22,
  color,
  bgColor,
  accent,
  shape    = 'rounded',
  style,
}: IconBadgeProps) {
  const palette: IconColorSet = accent ? colorsFromAccent(accent) : getIconColors(name)
  const iconColor = color   ?? palette.color
  const background = bgColor ?? palette.bg
  const dim = size + 20

  return (
    <View
      style={[
        styles.badge,
        shape === 'circle' ? { borderRadius: dim / 2 } : { borderRadius: 12 },
        { width: dim, height: dim, backgroundColor: background },
        style,
      ]}
    >
      <AppIcon name={name} size={size} color={iconColor} />
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems:     'center',
    justifyContent: 'center',
  },
})
