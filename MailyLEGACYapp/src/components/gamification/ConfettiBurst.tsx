/**
 * ConfettiBurst — partículas de celebración para subida de nivel.
 */

import React, { useEffect, useMemo } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'

const { width: W, height: H } = Dimensions.get('window')

const COLORS = ['#00C5E3', '#F5A623', '#10B981', '#8B5CF6', '#EF4444', '#3B82F6', '#F97316']

interface Particle {
  id:     number
  x:      number
  color:  string
  size:   number
  delay:  number
  drift:  number
  rotate: number
}

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id:     i,
    x:      Math.random() * W,
    color:  COLORS[i % COLORS.length],
    size:   6 + Math.random() * 6,
    delay:  Math.random() * 400,
    drift:  (Math.random() - 0.5) * 80,
    rotate: Math.random() * 360,
  }))
}

function ParticleView({ p, active }: { p: Particle; active: boolean }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (active) {
      progress.value = 0
      progress.value = withDelay(
        p.delay,
        withTiming(1, { duration: 2200 + Math.random() * 800, easing: Easing.out(Easing.quad) }),
      )
    }
  }, [active, p.delay, progress])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: p.x + p.drift * progress.value },
      { translateY: -40 + (H * 0.75) * progress.value },
      { rotate: `${p.rotate + progress.value * 540}deg` },
    ],
    opacity: progress.value < 0.85 ? 1 : 1 - (progress.value - 0.85) / 0.15,
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width:           p.size,
          height:          p.size * 0.6,
          backgroundColor: p.color,
          borderRadius:    2,
        },
        style,
      ]}
    />
  )
}

export function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useMemo(() => buildParticles(48), [active])

  if (!active) return null

  return (
    <View style={styles.layer} pointerEvents="none">
      {particles.map((p) => (
        <ParticleView key={`${active}-${p.id}`} p={p} active={active} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top:      0,
    left:     0,
  },
})
