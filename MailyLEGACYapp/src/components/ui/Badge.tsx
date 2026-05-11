import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  label:    string
  variant?: BadgeVariant
  size?:    'sm' | 'md'
}

const BG: Record<BadgeVariant, string> = {
  success: '#D1FAE5',
  warning: '#FEF3C7',
  error:   '#FEE2E2',
  info:    '#DBEAFE',
  neutral: '#F1F5F9',
}
const FG: Record<BadgeVariant, string> = {
  success: '#065F46',
  warning: '#92400E',
  error:   '#991B1B',
  info:    '#1E40AF',
  neutral: '#475569',
}

export function Badge({ label, variant = 'neutral', size = 'md' }: BadgeProps) {
  return (
    <View style={[styles.base, { backgroundColor: BG[variant] }, size === 'sm' && styles.sm]}>
      <Text style={[styles.text, { color: FG[variant] }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical:   4,
    paddingHorizontal: 10,
    borderRadius:      20,
    alignSelf:         'flex-start',
  },
  sm: {
    paddingVertical:   2,
    paddingHorizontal: 8,
  },
  text: {
    fontSize:   13,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
  },
})
