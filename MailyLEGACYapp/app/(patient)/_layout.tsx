/**
 * (patient)/_layout.tsx
 * Tab navigator del rol PATIENT.
 * 5 tabs: Inicio · Vitales · Medicamentos · Citas · Perfil
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

export default function PatientLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown:          false,
        tabBarActiveTintColor: Colors.role.patient,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => <Icon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vitals/index"
        options={{
          title: 'Vitales',
          tabBarIcon: ({ focused }) => <Icon emoji="❤️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="medications/index"
        options={{
          title: 'Medicamentos',
          tabBarIcon: ({ focused }) => <Icon emoji="💊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="appointments/index"
        options={{
          title: 'Citas',
          tabBarIcon: ({ focused }) => <Icon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} />,
        }}
      />
      {/* Pantallas que no aparecen en el tab bar */}
      <Tabs.Screen name="vitals/add"         options={{ href: null }} />
      <Tabs.Screen name="medications/[id]"   options={{ href: null }} />
      <Tabs.Screen name="appointments/[id]"  options={{ href: null }} />
      <Tabs.Screen name="notifications"      options={{ href: null }} />
    </Tabs>
  )
}
