/**
 * app/index.tsx
 * -------------
 * Splash animado + lógica de redirect según estado de autenticación.
 *
 * Flujo:
 *   1. Muestra animación del logo (Reanimated)
 *   2. Cuando Clerk termina de cargar:
 *      - Sin sesión   → /(auth)/sign-in
 *      - Con sesión   → si perfil completo → /(rol)/ | si no → /(auth)/role-setup
 */

import React, { useEffect, useCallback } from 'react'
import { View, Image, Text, StyleSheet, Dimensions } from 'react-native'
import { router } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useAuth } from '@clerk/clerk-expo'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated'

import { useAuthStore }  from '@store/auth.store'
import { get }          from '@lib/api/client'
import { EP }           from '@lib/api/endpoints'
import { Colors }       from '@constants/colors'
import type { MeResponse } from '@/types/api.types'

const { width } = Dimensions.get('window')

export default function SplashAnimatedScreen() {
  const { isLoaded, isSignedIn } = useAuth()
  const setLoaded   = useAuthStore((s) => s.setLoaded)
  const setSignedIn = useAuthStore((s) => s.setSignedIn)
  const setUser     = useAuthStore((s) => s.setUser)

  // Valores de animación
  const logoScale   = useSharedValue(0.3)
  const logoOpacity = useSharedValue(0)
  const textOpacity = useSharedValue(0)
  const tagOpacity  = useSharedValue(0)
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

    setLoaded(true)
    setSignedIn(!!isSignedIn)

    // Animación de salida
    containerScale.value = withTiming(0.95, { duration: 200 })

    await new Promise((r) => setTimeout(r, 200))
    await SplashScreen.hideAsync()

    if (!isSignedIn) {
      router.replace('/(auth)/sign-in')
      return
    }

    // Verificar si el perfil está completo
    try {
      const me = await get<MeResponse>(EP.authMe)
      setUser({
        id:        me.user.id,
        clerkId:   me.user.clerk_id,
        email:     me.user.email,
        role:      me.user.role ?? null,
        firstName: me.profile?.first_name ?? null,
        lastName:  me.profile?.last_name  ?? null,
        photoUrl:  me.profile?.photo_url  ?? null,
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
    } catch (err: unknown) {
      // Si el backend falla pero Clerk tiene sesión activa,
      // mandamos a role-setup (mejor UX que volver a sign-in en bucle).
      // Solo volvemos a sign-in si el error es 401 (token inválido).
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        router.replace('/(auth)/sign-in')
      } else {
        // Backend no disponible, red caída, etc. → intentar continuar
        router.replace('/(auth)/role-setup')
      }
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    // Secuencia de entrada del logo
    logoOpacity.value = withTiming(1, { duration: 300 })
    logoScale.value   = withSpring(1, { damping: 12, stiffness: 120 })

    textOpacity.value = withDelay(300, withTiming(1, { duration: 350 }))
    tagOpacity.value  = withDelay(450, withTiming(1, { duration: 350 }))

    // Cuando Clerk carga → navegar
    if (isLoaded) {
      const timer = setTimeout(() => {
        runOnJS(navigate)()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isLoaded])

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
