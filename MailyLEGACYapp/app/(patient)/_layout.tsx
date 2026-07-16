/**
 * (patient)/_layout.tsx — usa TabIcon compartido
 */
import React from 'react'
import { Tabs } from 'expo-router'
import { TabIcon, useTabBarStyle } from '@components/layout/TabIcon'
import { PatientGamificationInit } from '@components/gamification/PatientGamificationInit'

export default function PatientLayout() {
  const tabBarStyle = useTabBarStyle()

  return (
    <>
      <PatientGamificationInit />
      <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarShowLabel: false,
        tabBarStyle,
        tabBarItemStyle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
      }}
    >
      <Tabs.Screen name="index"              options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }} />
      <Tabs.Screen name="labs/index"        options={{ tabBarIcon: ({ focused }) => <TabIcon name="lab" focused={focused} /> }} />
      <Tabs.Screen name="prescriptions/index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="clipboard" focused={focused} /> }} />
      <Tabs.Screen name="medications/index"  options={{ tabBarIcon: ({ focused }) => <TabIcon name="pill" focused={focused} /> }} />
      <Tabs.Screen name="activities/index"   options={{ tabBarIcon: ({ focused }) => <TabIcon name="run" focused={focused} /> }} />
      <Tabs.Screen name="vitals/index"       options={{ tabBarIcon: ({ focused }) => <TabIcon name="stethoscope" focused={focused} /> }} />
      <Tabs.Screen name="vitals/add"           options={{ href: null }} />
      <Tabs.Screen name="vitals/[type]"        options={{ href: null }} />
      <Tabs.Screen name="medications/[id]"     options={{ href: null }} />
      <Tabs.Screen name="appointments/index"   options={{ href: null }} />
      <Tabs.Screen name="appointments/[id]"    options={{ href: null }} />
      <Tabs.Screen name="notifications"        options={{ href: null }} />
      <Tabs.Screen name="profile"              options={{ href: null }} />
      <Tabs.Screen name="gamification"         options={{ href: null }} />
      <Tabs.Screen name="family-care/index"    options={{ href: null }} />
      <Tabs.Screen name="documents/index"      options={{ href: null }} />
      <Tabs.Screen name="plans"                options={{ href: null }} />
      <Tabs.Screen name="dev/level-badges"     options={{ href: null }} />
      <Tabs.Screen name="ai-chat"              options={{ href: null }} />
      <Tabs.Screen name="settings"             options={{ href: null }} />
    </Tabs>
    </>
  )
}
