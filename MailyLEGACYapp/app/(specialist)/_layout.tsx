/**
 * (specialist)/_layout.tsx
 */
import React from 'react'
import { Tabs } from 'expo-router'
import { TabIcon, useTabBarStyle } from '@components/layout/TabIcon'

export default function SpecialistLayout() {
  const tabBarStyle = useTabBarStyle()

  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarShowLabel: false,
        tabBarStyle,
        tabBarItemStyle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
      }}
    >
      <Tabs.Screen name="index"           options={{ tabBarIcon: ({ focused }) => <TabIcon name="lab" focused={focused} /> }} />
      <Tabs.Screen name="referrals/index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="clipboard" focused={focused} /> }} />
      <Tabs.Screen name="profile"         options={{ tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} /> }} />
    </Tabs>
  )
}
