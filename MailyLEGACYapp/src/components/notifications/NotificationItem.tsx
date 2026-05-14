/**
 * NotificationItem.tsx
 * Fila de notificación con indicador de no leída y timestamp.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import type { Notification } from '@hooks/useNotifications'

interface NotificationItemProps {
  notification: Notification
  onPress?:     () => void
}

const TYPE_ICON: Record<string, string> = {
  medication:  '💊',
  appointment: '📅',
  vital:       '❤️',
  lab:         '🧪',
  referral:    '📋',
  payment:     '💳',
  system:      '🔔',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} d`
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const icon = TYPE_ICON[notification.type] ?? '🔔'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, !notification.is_read && styles.unread]}
    >
      {!notification.is_read && <View style={styles.dot} />}

      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, !notification.is_read && styles.titleBold]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.time}>{timeAgo(notification.created_at)}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingVertical:   14,
    paddingHorizontal: 16,
    backgroundColor:   Colors.light.card,
    borderRadius:      12,
    marginBottom:      8,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.04,
    shadowRadius:      4,
    elevation:         2,
  },
  unread: {
    backgroundColor: '#F0FFFE',
  },
  dot: {
    position:     'absolute',
    top:          16,
    left:         6,
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: Colors.brand.primary,
  },
  iconBox: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.light.surface,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    gap:  3,
  },
  title: {
    fontSize:   14,
    color:      Colors.light.textPrimary,
    fontWeight: '500',
  },
  titleBold: {
    fontWeight: '700',
  },
  body: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    lineHeight: 18,
  },
  time: {
    fontSize:  12,
    color:     Colors.light.textMuted,
    marginTop: 2,
  },
})
