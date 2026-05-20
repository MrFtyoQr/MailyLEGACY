/**
 * (patient)/_layout.tsx
 * Tab navigator — barra nativa de Expo Router/React Navigation.
 * Sin componente custom: tabBarIcon + tabBarStyle, mismo patrón que Instagram.
 */

import React from 'react'
import { View, Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@constants/colors'

const ACTIVE = Colors.brand.primary

// Icono con punto activo debajo — igual que Instagram
function EmojiIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 26, opacity: focused ? 1 : 0.38 }}>{emoji}</Text>
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: ACTIVE }} />
      )}
    </View>
  )
}

export default function PatientLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown:      false,
        tabBarShowLabel:  false,
        tabBarStyle: {
          backgroundColor:  '#FFFFFF',
          borderTopWidth:   1,
          borderTopColor:   '#EDF2F7',
          height:           56 + insets.bottom,
          paddingBottom:    insets.bottom,
          paddingTop:       6,
          elevation:        12,
          shadowColor:      '#000',
          shadowOffset:     { width: 0, height: -2 },
          shadowOpacity:    0.06,
          shadowRadius:     8,
        },
        tabBarItemStyle: {
          flex:             1,
          justifyContent:   'center',
          alignItems:       'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <EmojiIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="labs/index"
        options={{
          tabBarIcon: ({ focused }) => <EmojiIcon emoji="🔬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="prescriptions/index"
        options={{
          tabBarIcon: ({ focused }) => <EmojiIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="medications/index"
        options={{
          tabBarIcon: ({ focused }) => <EmojiIcon emoji="💊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="activities/index"
        options={{
          tabBarIcon: ({ focused }) => <EmojiIcon emoji="🏃" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vitals/index"
        options={{
          tabBarIcon: ({ focused }) => <EmojiIcon emoji="🩺" focused={focused} />,
        }}
      />

      {/* Pantallas sin tab */}
      <Tabs.Screen name="vitals/add"           options={{ href: null }} />
      <Tabs.Screen name="vitals/[type]"        options={{ href: null }} />
      <Tabs.Screen name="medications/[id]"     options={{ href: null }} />
      <Tabs.Screen name="appointments/index"   options={{ href: null }} />
      <Tabs.Screen name="appointments/[id]"    options={{ href: null }} />
      <Tabs.Screen name="notifications"        options={{ href: null }} />
      <Tabs.Screen name="profile"              options={{ href: null }} />
      <Tabs.Screen name="gamification"         options={{ href: null }} />
      <Tabs.Screen name="family-care/index"    options={{ href: null }} />
    </Tabs>
  )
}
