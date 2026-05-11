import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated'
import { Colors } from '@constants/colors'

interface SkeletonProps {
  width?:        number | `${number}%`
  height?:       number
  borderRadius?: number
  style?:        object
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 900 }),
      -1,
      true,
    )
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.light.border, '#E2E8F0'],
    ),
  }))

  return (
    <Animated.View
      style={[
        { width: width as never, height, borderRadius },
        animStyle,
        style,
      ]}
    />
  )
}

/** Bloque de filas skeleton para listas */
export function SkeletonList({ rows = 3, gap = 12 }: { rows?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={styles.lines}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  lines: {
    flex: 1,
    gap:  8,
  },
})
