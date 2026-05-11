import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import { Button } from './Button'

interface EmptyStateProps {
  icon?:     string       // emoji
  title:     string
  subtitle?: string
  actionLabel?: string
  onAction?:    () => void
}

export function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
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
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical:   48,
    gap:            12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize:   18,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:  14,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: 8,
  },
})
