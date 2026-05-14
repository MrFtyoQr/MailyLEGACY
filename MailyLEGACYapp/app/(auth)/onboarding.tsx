/**
 * onboarding.tsx
 * Slides de bienvenida — aparecen solo la primera vez.
 * 4 pantallas deslizables con gradiente y contenido promocional.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
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

const { width, height } = Dimensions.get('window')
export const ONBOARDING_KEY = '@mailyt_onboarding_done'

interface Slide {
  id:       string
  emoji:    string
  tag:      string
  title:    string
  subtitle: string
  gradient: [string, string]
}

const SLIDES: Slide[] = [
  {
    id:       '1',
    emoji:    '❤️',
    tag:      'La salud familiar',
    title:    'a un toque de ti',
    subtitle: 'Registra signos vitales, medicamentos y resultados de laboratorio desde un solo lugar. Tu historial siempre disponible.',
    gradient: ['#FF6B8A', '#C44569'],
  },
  {
    id:       '2',
    emoji:    '🩺',
    tag:      'Cuidado y seguimiento',
    title:    'personalizado',
    subtitle: 'Recibe recordatorios de tus medicamentos, monitorea tus signos y lleva un control completo de tu salud día a día.',
    gradient: [Colors.brand.primary, '#0A7A6B'],
  },
  {
    id:       '3',
    emoji:    '👨‍👩‍👧',
    tag:      'Conectado con',
    title:    'toda tu familia',
    subtitle: 'Comparte el acceso con familiares de confianza para un cuidado integral y coordinado. Cuida a quienes amas.',
    gradient: ['#6C63FF', '#3B37B0'],
  },
  {
    id:       '4',
    emoji:    '🤖',
    tag:      'Asistente de salud',
    title:    'con IA a tu lado',
    subtitle: 'Consulta a nuestro asistente inteligente sobre tus datos de salud, obtén recomendaciones y alertas en tiempo real.',
    gradient: ['#F8A600', '#E06B00'],
  },
]

function AnimatedDot({ index, currentIndex }: { index: number; currentIndex: number }) {
  const progress = useSharedValue(currentIndex === index ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(currentIndex === index ? 1 : 0, { duration: 300 })
  }, [currentIndex, index])

  const dotStyle = useAnimatedStyle(() => ({
    width: 8 + progress.value * 20,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(255,255,255,0.35)', '#FFFFFF'],
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
  const slide  = SLIDES[currentIndex]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

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
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.slideInner}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={styles.textBlock}>
                <Text style={styles.tag}>{item.tag}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
            </View>
          </LinearGradient>
        )}
      />

      {/* Footer pegado al fondo con gradiente del slide actual */}
      <LinearGradient
        colors={slide.gradient}
        style={styles.footer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <AnimatedDot key={i} index={i} currentIndex={currentIndex} />
          ))}
        </View>

        {/* Botón principal */}
        <TouchableOpacity
          style={styles.mainBtn}
          onPress={goToNext}
          activeOpacity={0.85}
        >
          <Text style={styles.mainBtnText}>
            {isLast ? 'Comenzar ahora →' : 'Siguiente →'}
          </Text>
        </TouchableOpacity>

        {/* Saltar */}
        {!isLast && (
          <TouchableOpacity onPress={finish} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Saltar introducción</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#1A1A2E',
  },
  slide: {
    width,
    height: height * 0.7,
  },
  slideInner: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 36,
    gap:               28,
  },
  emoji: {
    fontSize: 80,
  },
  textBlock: {
    alignItems: 'center',
    gap:        10,
  },
  tag: {
    fontSize:      13,
    fontWeight:    '600',
    color:         'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize:   32,
    fontWeight: '800',
    color:      '#FFFFFF',
    textAlign:  'center',
    lineHeight: 40,
  },
  subtitle: {
    fontSize:  15,
    color:     'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 23,
    marginTop:  4,
  },
  footer: {
    flex:              1,
    paddingHorizontal: 28,
    paddingTop:        24,
    paddingBottom:     40,
    gap:               20,
    alignItems:        'center',
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
  mainBtn: {
    width:           '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.5)',
    borderRadius:    16,
    paddingVertical: 18,
    alignItems:      'center',
  },
  mainBtnText: {
    fontSize:   17,
    fontWeight: '700',
    color:      '#FFFFFF',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 4,
  },
  skipText: {
    fontSize:  14,
    color:     'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
})
