/**
 * NotificationItem.tsx
 * Fila de notificación con cápsula 3D e iconos vectoriales.
 */

import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'
import { Capsule3D } from '@components/ui/Capsule3D'
import type { Notification } from '@hooks/useNotifications'

interface NotificationItemProps {
  notification: Notification
  onPress?:     () => void
}

const TYPE_ICON: Record<string, AppIconName> = {
  medication:  'pill',
  appointment: 'calendar',
  vital:       'heart',
  lab:         'lab',
  referral:    'clipboard',
  payment:     'card',
  system:      'bell',
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
  const iconName = TYPE_ICON[notification.type] ?? 'bell'
  const faceColor = notification.is_read ? '#FFFFFF' : '#F0FFFE'

  return (
    <Capsule3D
      pressable={!!onPress}
      onPress={onPress}
      faceColor={faceColor}
      shadowColor="#E2E8F0"
      depth="sm"
      borderRadius={14}
      style={styles.wrap}
      faceStyle={styles.container}
    >
      {!notification.is_read && <View style={styles.dot} />}

      <View style={styles.iconBox}>
        <AppIcon name={iconName} size={20} color={Colors.brand.primary} />
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
    </Capsule3D>
  )
}

const styles = StyleSheet.create({
  wrap:      { marginBottom: 10 },
  container: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  dot: {
    position:        'absolute',
    top:             16,
    left:            8,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.brand.primary,
    zIndex:          1,
  },
  iconBox: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: Colors.brand.primary + '15',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  content: { flex: 1, gap: 3 },
  title: {
    fontSize:   14,
    color:      Colors.light.textPrimary,
    fontWeight: '500',
  },
  titleBold: { fontWeight: '700' },
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
