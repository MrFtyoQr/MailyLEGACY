/**
 * (patient)/notifications.tsx
 * Lista de notificaciones + marcar leídas.
 */

import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { EmptyState } from '@components/ui/EmptyState'
import { NotificationItem } from '@components/notifications/NotificationItem'
import { Colors } from '@constants/colors'
import { useNotifications, useMarkRead, useMarkAllRead } from '@hooks/useNotifications'

export default function NotificationsScreen() {
  const { data: notifications, isLoading } = useNotifications()
  const markRead    = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => markAllRead.mutate()}
            activeOpacity={0.7}
            disabled={markAllRead.isPending}
          >
            <Text style={styles.markAll}>Leídas</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => {
                if (!item.is_read) markRead.mutate(item.id)
              }}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title="Sin notificaciones"
              subtitle="Aquí aparecerán tus alertas de medicamentos, citas y signos vitales."
            />
          }
        />
      )}
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  back: {
    fontSize:   24,
    color:      Colors.brand.primary,
    fontWeight: '700',
    minWidth:   24,
  },
  title: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  markAll: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom:     40,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
})
