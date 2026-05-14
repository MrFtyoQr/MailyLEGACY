/**
 * (specialist)/_layout.tsx
 * Tab navigator del rol SPECIALIST.
 * 4 tabs: Inicio · Referidos · Agenda · Perfil
 */

import React from 'react'
import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { TabBar } from '@components/layout/TabBar'
import { Colors } from '@constants/colors'

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  )
}

export default function SpecialistLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown:           false,
        tabBarActiveTintColor: Colors.role.specialist,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => <Icon emoji="🔬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="referrals/index"
        options={{
          title: 'Referidos',
          tabBarIcon: ({ focused }) => <Icon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
