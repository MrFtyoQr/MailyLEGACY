/**
 * InfoRow.tsx
 * Fila de información con icono vectorial coloreado (sin emojis).
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import { IconBadge } from './IconBadge'
import type { AppIconName } from './AppIcon'

interface InfoRowProps {
  icon?:    AppIconName
  label:    string
  value:    string
  divider?: boolean
}

export function InfoRow({ icon, label, value, divider }: InfoRowProps) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      {icon && <IconBadge name={icon} size={18} style={styles.badge} />}
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 14,
    gap:           12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  badge: { flexShrink: 0 },
  text:  { flex: 1, gap: 2 },
  label: { fontSize: 12, color: Colors.light.textMuted, fontWeight: '500' },
  value: { fontSize: 15, color: Colors.light.textPrimary, fontWeight: '600' },
})
