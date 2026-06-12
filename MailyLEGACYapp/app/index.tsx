/**
 * app/index.tsx
 * -------------
 * Splash animado + lógica de redirect según estado de autenticación.
 *
 * Flujo:
 *   1. Muestra animación del logo (Reanimated)
 *   2. Cuando auth store termina de cargar (tokens leídos de SecureStore):
 *      - Sin sesión   → /(auth)/onboarding (primera vez) | /(auth)/sign-in
 *      - Con sesión   → si perfil completo → /(rol)/ | si no → /(auth)/role-setup
 */

import React, { useEffect, useCallback, useState } from 'react'
import { View, Image, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore }  from '@store/auth.store'
import { get }           from '@lib/api/client'
import { EP }            from '@lib/api/endpoints'
import { Colors }        from '@constants/colors'
import { ONBOARDING_KEY } from './(auth)/onboarding'
import type { MeResponse } from '@/types/api.types'

const { width } = Dimensions.get('window')

export default function SplashAnimatedScreen() {
  const { isLoaded, isSignedIn } = useAuthStore()
  const setLoaded   = useAuthStore((s) => s.setLoaded)
  const setSignedIn = useAuthStore((s) => s.setSignedIn)
  const setUser     = useAuthStore((s) => s.setUser)
  const [networkError, setNetworkError] = useState(false)

  // Valores de animación
  const logoScale      = useSharedValue(0.3)
  const logoOpacity    = useSharedValue(0)
  const textOpacity    = useSharedValue(0)
  const tagOpacity     = useSharedValue(0)
  const containerScale = useSharedValue(1)

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity:   logoOpacity.value,
  }))

  const textStyle = useAnimatedStyle(() => ({
    opacity:   textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 12 }],
  }))

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
  }))

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }))

  const navigate = useCallback(async () => {
    if (!isLoaded) return

    containerScale.value = withTiming(0.95, { duration: 200 })
    await new Promise((r) => setTimeout(r, 200))
    await SplashScreen.hideAsync()

    if (!isSignedIn) {
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY)
      if (!onboardingDone) {
        router.replace('/(auth)/onboarding')
      } else {
        router.replace('/(auth)/sign-in')
      }
      return
    }

    const handleMe = async (me: MeResponse) => {
      setUser({
        id:        me.user.id,
        email:     me.user.email,
        role:      me.user.role ?? null,
        firstName: (me.profile as { first_name?: string } | null)?.first_name ?? null,
        lastName:  (me.profile as { last_name?: string }  | null)?.last_name  ?? null,
        photoUrl:  (me.profile as { photo_url?: string }  | null)?.photo_url  ?? null,
      })
      if (!me.is_complete || !me.user.role) {
        router.replace('/(auth)/role-setup')
        return
      }
      const roleMap: Record<string, string> = {
        PATIENT:    '/(patient)',
        DOCTOR:     '/(doctor)',
        SPECIALIST: '/(specialist)',
      }
      router.replace((roleMap[me.user.role] ?? '/(auth)/role-setup') as never)
    }

    // Reintentar una vez automáticamente antes de mostrar error
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const me = await get<MeResponse>(EP.authMe)
        setNetworkError(false)
        await handleMe(me)
        return
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status ?? 0
        // 401 / 403 → token inválido o expirado → ir al login, no mostrar "sin conexión"
        if (status === 401 || status === 403) {
          await SplashScreen.hideAsync()
          const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY)
          router.replace(onboardingDone ? '/(auth)/sign-in' : '/(auth)/onboarding')
          return
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
    }
    // Si ambos intentos fallaron por error de red real
    setNetworkError(true)
    await SplashScreen.hideAsync()
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 300 })
    logoScale.value   = withSpring(1, { damping: 12, stiffness: 120 })

    textOpacity.value = withDelay(300, withTiming(1, { duration: 350 }))
    tagOpacity.value  = withDelay(450, withTiming(1, { duration: 350 }))

    if (isLoaded) {
      const timer = setTimeout(() => {
        runOnJS(navigate)()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isLoaded])

  if (networkError) {
    return (
      <View style={styles.container}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
        <Text style={styles.appName}>Sin conexión</Text>
        <Text style={[styles.tagLine, { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
          No se pudo conectar al servidor.{'\n'}Verifica tu conexión e intenta de nuevo.
        </Text>
        <TouchableOpacity
          onPress={() => { setNetworkError(false); navigate() }}
          style={{ marginTop: 32, backgroundColor: Colors.brand.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brand, containerStyle]}>
        <Animated.View style={[logoStyle]}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={textStyle}>
          <Text style={styles.appName}>maily</Text>
        </Animated.View>

        <Animated.View style={tagStyle}>
          <Text style={styles.tagLine}>T-Cuida</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.footer, tagStyle]}>
        <Text style={styles.footerText}>Salud conectada para toda la familia</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.dark.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  brand: {
    alignItems: 'center',
    gap:        8,
  },
  logo: {
    width:  120,
    height: 120,
  },
  appName: {
    fontSize:      42,
    fontWeight:    '800',
    color:         '#FFFFFF',
    letterSpacing: -1,
  },
  tagLine: {
    fontSize:      20,
    fontWeight:    '600',
    color:         Colors.brand.primary,
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    bottom:   48,
  },
  footerText: {
    fontSize: 13,
    color:    Colors.dark.textSecondary,
  },
})
