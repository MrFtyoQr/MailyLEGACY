/**
 * MenuRow.tsx — fila de menú/ajustes con icono vectorial coloreado.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import { IconBadge } from './IconBadge'
import { AppIcon } from './AppIcon'
import type { AppIconName } from './AppIcon'

interface MenuRowProps {
  icon?:     AppIconName
  leftIcon?: React.ReactNode
  label:     string
  onPress?:  () => void
  right?:    React.ReactNode
}

export function MenuRow({ icon, leftIcon, label, onPress, right }: MenuRowProps) {
  const inner = (
    <>
      {leftIcon ?? (icon ? <IconBadge name={icon} size={18} /> : null)}
      <Text style={styles.label}>{label}</Text>
      {right ?? <AppIcon name="chevron-right" size={18} color={Colors.light.textMuted} />}
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    )
  }

  return <View style={styles.row}>{inner}</View>
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       14,
    gap:           12,
  },
  label: {
    flex:       1,
    fontSize:   14,
    color:      Colors.light.textPrimary,
    fontWeight: '500',
  },
})
