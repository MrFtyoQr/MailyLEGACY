/**
 * TabBar.tsx
 * ----------
 * Tab bar personalizado con gradiente brand.
 * Compatible con Expo Router (BottomTabBarProps).
 */

import React from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Colors } from '@constants/colors'

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF']}
        style={styles.fadeTop}
        pointerEvents="none"
      />
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name

          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type:     'tabPress',
              target:   route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color:   isFocused ? Colors.brand.primary : Colors.light.textMuted,
                size:    24,
              })}
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? Colors.brand.primary : Colors.light.textMuted },
                ]}
              >
                {label}
              </Text>
              {isFocused && <View style={styles.dot} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
  },
  fadeTop: {
    height: 16,
  },
  container: {
    flexDirection:   'row',
    backgroundColor: '#FFFFFF',
    paddingBottom:   Platform.OS === 'ios' ? 24 : 12,
    paddingTop:      10,
    paddingHorizontal: 8,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -4 },
    shadowOpacity:   0.06,
    shadowRadius:    12,
    elevation:       16,
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
  },
  label: {
    fontSize:   10,
    fontWeight: '600',
  },
  dot: {
    position:     'absolute',
    bottom:       -6,
    width:        4,
    height:       4,
    borderRadius: 2,
    backgroundColor: Colors.brand.primary,
  },
})
