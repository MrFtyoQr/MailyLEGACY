/**
 * (patient)/_layout.tsx
 * Tab navigator del rol PATIENT — 6 tabs, solo iconos.
 * Home · Labs · Recetas · Medicamentos · Actividades · Enfermería
 */

import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Colors } from '@constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ACTIVE_COLOR   = Colors.brand.primary
const INACTIVE_COLOR = '#A0AEC0'
const TAB_BG         = '#FFFFFF'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
  )
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets()

  // Filtrar solo los tabs visibles antes de renderizar
  const visibleRoutes = state.routes.filter(
    (route: any) => descriptors[route.key]?.options?.href !== null
  )

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key]
        const focused = state.routes[state.index]?.key === route.key

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <View key={route.key} style={styles.tabItem}>
            <Text
              onPress={onPress}
              style={[styles.tabEmoji, { opacity: focused ? 1 : 0.4 }]}
            >
              {options.tabBarLabel}
            </Text>
            {focused && <View style={styles.activeDot} />}
          </View>
        )
      })}
    </View>
  )
}

export default function PatientLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarLabel: '🏠' }}
      />
      <Tabs.Screen
        name="labs/index"
        options={{ tabBarLabel: '🔬' }}
      />
      <Tabs.Screen
        name="prescriptions/index"
        options={{ tabBarLabel: '📋' }}
      />
      <Tabs.Screen
        name="medications/index"
        options={{ tabBarLabel: '💊' }}
      />
      <Tabs.Screen
        name="activities/index"
        options={{ tabBarLabel: '🏃' }}
      />
      <Tabs.Screen
        name="vitals/index"
        options={{ tabBarLabel: '🩺' }}
      />

      {/* Pantallas que no aparecen en el tab bar */}
      <Tabs.Screen name="vitals/add"            options={{ href: null }} />
      <Tabs.Screen name="medications/[id]"      options={{ href: null }} />
      <Tabs.Screen name="appointments/index"    options={{ href: null }} />
      <Tabs.Screen name="appointments/[id]"     options={{ href: null }} />
      <Tabs.Screen name="notifications"         options={{ href: null }} />
      <Tabs.Screen name="profile"               options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    justifyContent:    'space-evenly',
    alignItems:        'center',
    backgroundColor:   TAB_BG,
    paddingTop:        10,
    borderTopWidth:    1,
    borderTopColor:    '#EDF2F7',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.06,
    shadowRadius:      8,
    elevation:         12,
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap:            4,
  },
  tabEmoji: {
    fontSize: 26,
  },
  activeDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: ACTIVE_COLOR,
  },
})
