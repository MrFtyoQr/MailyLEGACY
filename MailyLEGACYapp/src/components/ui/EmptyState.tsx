import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import { Button } from './Button'
import { IconBadge } from './IconBadge'
import type { AppIconName } from './AppIcon'

interface EmptyStateProps {
  icon?:      AppIconName
  title:      string
  subtitle?:  string
  actionLabel?: string
  onAction?:    () => void
}

export function EmptyState({
  icon = 'inbox',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <IconBadge name={icon} size={32} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} size="sm" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    paddingVertical:   48,
    gap:               12,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   14,
    color:      Colors.light.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
  action: { marginTop: 8 },
})
