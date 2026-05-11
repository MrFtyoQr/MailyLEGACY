/**
 * GradientText.tsx
 * ----------------
 * Texto con gradiente usando MaskedView + LinearGradient.
 * Compatible con Expo SDK 52.
 */

import React from 'react'
import { Text, StyleSheet, type TextStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import MaskedView from '@react-native-masked-view/masked-view'
import { Colors } from '@constants/colors'

interface GradientTextProps {
  text:      string
  colors?:   readonly [string, string, ...string[]]
  style?:    TextStyle
  start?:    { x: number; y: number }
  end?:      { x: number; y: number }
}

export function GradientText({
  text,
  colors = Colors.gradients.logo,
  style,
  start = { x: 0, y: 0 },
  end   = { x: 1, y: 0 },
}: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <Text style={[styles.text, style]}>{text}</Text>
      }
    >
      <LinearGradient colors={colors} start={start} end={end}>
        <Text style={[styles.text, style, styles.transparent]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  )
}

const styles = StyleSheet.create({
  text: {
    fontSize:   24,
    fontWeight: '800',
  },
  transparent: {
    opacity: 0,
  },
})
