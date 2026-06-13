/**
 * (doctor)/_layout.tsx
 */
import React from 'react'
import { Tabs } from 'expo-router'
import { TabIcon, useTabBarStyle } from '@components/layout/TabIcon'

export default function DoctorLayout() {
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
      <Tabs.Screen name="index"        options={{ tabBarIcon: ({ focused }) => <TabIcon name="hospital" focused={focused} /> }} />
      <Tabs.Screen name="patients/index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} /> }} />
      <Tabs.Screen name="appointments/index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} /> }} />
      <Tabs.Screen name="profile"      options={{ tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} /> }} />
      <Tabs.Screen name="patients/[id]" options={{ href: null }} />
    </Tabs>
  )
}
