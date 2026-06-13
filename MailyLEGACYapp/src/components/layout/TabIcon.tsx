/**
 * doctor/_layout.tsx & specialist/_layout.tsx pattern
 */
import React from 'react'
import { View } from 'react-native'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@constants/colors'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'

const ACTIVE   = Colors.brand.primary
const INACTIVE = Colors.light.textMuted

export function TabIcon({ name, focused }: { name: AppIconName; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <AppIcon name={name} size={24} color={focused ? ACTIVE : INACTIVE} />
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: ACTIVE }} />
      )}
    </View>
  )
}

export function useTabBarStyle() {
  const insets = useSafeAreaInsets()
  return {
    backgroundColor: '#FFFFFF',
    borderTopWidth:  2,
    borderTopColor:  '#E2E8F0',
    height:          56 + insets.bottom,
    paddingBottom:   insets.bottom,
    paddingTop:      6,
    elevation:       0,
  } as const
}
