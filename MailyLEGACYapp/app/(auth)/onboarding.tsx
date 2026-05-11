/**
 * onboarding.tsx
 * --------------
 * 3 slides horizontales con FlatList paginado.
 * - Dots animados con Reanimated interpolatedColor
 * - AsyncStorage flag: no repetir si ya se vio
 * - Saltar → sign-in
 * - Último slide → sign-in
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolateColor,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '@constants/colors'
import { Button } from '@components/ui/Button'

const { width, height } = Dimensions.get('window')
const ONBOARDING_KEY = '@mailyt_onboarding_done'

interface Slide {
  id:       string
  emoji:    string
  title:    string
  subtitle: string
  gradient: [string, string]
}

const SLIDES: Slide[] = [
  {
    id:       '1',
    emoji:    '❤️',
    title:    'Tu salud, siempre contigo',
    subtitle: 'Registra signos vitales, medicamentos y citas médicas desde un solo lugar.',
    gradient: [Colors.brand.warm, Colors.brand.hot],
  },
  {
    id:       '2',
    emoji:    '👨‍⚕️',
    title:    'Conectado con tu médico',
    subtitle: 'Agenda consultas y recibe seguimiento personalizado de tu doctor o especialista.',
    gradient: [Colors.brand.cool, Colors.brand.primary],
  },
  {
    id:       '3',
    emoji:    '👨‍👩‍👧',
    title:    'Cuida a quienes amas',
    subtitle: 'Comparte el acceso con familia de confianza para un cuidado integral y coordinado.',
    gradient: [Colors.brand.primary, Colors.brand.nature],
  },
]

function AnimatedDot({ index, currentIndex }: { index: number; currentIndex: number }) {
  const progress = useSharedValue(currentIndex === index ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(currentIndex === index ? 1 : 0, { duration: 300 })
  }, [currentIndex, index])

  const dotStyle = useAnimatedStyle(() => ({
    width: 8 + progress.value * 16,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.light.border, Colors.brand.primary],
    ),
  }))

  return <Animated.View style={[styles.dot, dotStyle]} />
}

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const listRef = useRef<FlatList>(null)

  const goToNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
    } else {
      finish()
    }
  }, [currentIndex])

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    router.replace('/(auth)/sign-in')
  }

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems[0]?.index != null) {
        setCurrentIndex(viewableItems[0].index)
      }
    },
    [],
  )

  const isLast = currentIndex === SLIDES.length - 1

  return (
    <View style={styles.container}>
      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <LinearGradient
            colors={item.gradient}
            style={styles.slide}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </LinearGradient>
        )}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <AnimatedDot key={i} index={i} currentIndex={currentIndex} />
          ))}
        </View>

        {/* Botones */}
        <View style={styles.buttons}>
          <Button
            label={isLast ? 'Comenzar' : 'Siguiente'}
            onPress={goToNext}
            fullWidth
            size="lg"
          />

          {!isLast && (
            <TouchableOpacity onPress={finish} style={styles.skipBtn}>
              <Text style={styles.skipText}>Saltar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
  slide: {
    width,
    height:         height * 0.72,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap:            20,
  },
  emoji: {
    fontSize: 72,
  },
  slideTitle: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#FFFFFF',
    textAlign:  'center',
    lineHeight: 36,
  },
  slideSubtitle: {
    fontSize:  16,
    color:     'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    flex:              1,
    backgroundColor:   Colors.dark.bg,
    paddingHorizontal: 28,
    paddingTop:        28,
    gap:               24,
  },
  dots: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
  },
  dot: {
    height:       8,
    borderRadius: 4,
  },
  buttons: {
    gap: 12,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize:  14,
    color:     Colors.dark.textSecondary,
    fontWeight: '500',
  },
})
