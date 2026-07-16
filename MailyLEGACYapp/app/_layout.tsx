/**
 * app/_layout.tsx
 * ---------------
 * Root layout de Expo Router.
 * Orden de providers (outer → inner):
 *   1. Sentry ErrorBoundary
 *   2. QueryClientProvider
 *   3. GestureHandlerRootView
 *   4. SafeAreaProvider
 *   5. NativeAuthInit (conecta WS cuando hay sesión, inyecta token en axios)
 *   6. <Slot />
 *
 * Clerk ha sido eliminado. La autenticación es propia vía JWT + SecureStore.
 */

import 'react-native-gesture-handler'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot, SplashScreen } from 'expo-router'
import { StyleSheet } from 'react-native'

import { GamificationCelebrationHost } from '@components/gamification/GamificationCelebrationHost'
import { initSentry, SentryErrorBoundary } from '@lib/sentry'
import * as Sentry from '@sentry/react-native'
import { setTokenGetter } from '@lib/api/client'
import { getAccessToken } from '@lib/auth/session'
import { notificationSocket } from '@lib/ws/NotificationSocket'
import { useWsStore }   from '@store/ws.store'
import { useAuthStore } from '@store/auth.store'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import type { MeResponse } from '@/types/api.types'
import { fetchPlayerProfile } from '@hooks/useGamification'

// Inicializar Sentry lo antes posible
initSentry()

if (__DEV__) {
  Sentry.captureMessage('MailyT-Cuida: Sentry inicializado correctamente', 'info')
}

// Mantener el splash nativo hasta que estemos listos
SplashScreen.preventAutoHideAsync()

// QueryClient singleton con retry strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:                1,
      refetchOnWindowFocus: false,
      staleTime:            2 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ---------------------------------------------------------------------------
// Sub-componente: inyecta token en axios y conecta WS cuando hay sesión
// ---------------------------------------------------------------------------

function NativeAuthInit() {
  const isSignedIn      = useAuthStore((s) => s.isSignedIn)
  const setSignedIn     = useAuthStore((s) => s.setSignedIn)
  const setLoaded       = useAuthStore((s) => s.setLoaded)
  const setUser         = useAuthStore((s) => s.setUser)
  const setNotifStatus  = useWsStore((s) => s.setNotifStatus)
  const incrementUnread = useWsStore((s) => s.incrementUnread)

  useEffect(() => {
    // Inyectar el getter de token JWT en el cliente axios
    setTokenGetter(getAccessToken)

    // Verificar si hay token en SecureStore → actualizar estado de auth
    getAccessToken().then(async (token) => {
      setSignedIn(!!token)
      if (token) {
        try {
          const me = await get<MeResponse>(EP.authMe)
          setUser({
            id:        me.user.id,
            email:     me.user.email,
            role:      me.user.role ?? null,
            firstName: (me.profile as { first_name?: string } | null)?.first_name ?? null,
            lastName:  (me.profile as { last_name?: string }  | null)?.last_name  ?? null,
            photoUrl:  (me.profile as { photo_url?: string }  | null)?.photo_url  ?? null,
          })
          if (me.user.role === 'PATIENT') {
            queryClient.prefetchQuery({
              queryKey: ['player-profile'],
              queryFn:  fetchPlayerProfile,
            })
          }
        } catch {
          // El splash/index.tsx reintentará cargar el perfil.
        }
      }
      setLoaded(true)
    })
  }, [setSignedIn, setLoaded, setUser])

  useEffect(() => {
    if (!isSignedIn) {
      notificationSocket.disconnect()
      return
    }

    // Conectar WS con el token almacenado
    let active = true
    getAccessToken().then((token) => {
      if (!token || !active) return
      notificationSocket.setCallbacks({
        onStatus: (s) => setNotifStatus(s),
        onNotif:  () => {
          incrementUnread()
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        },
      })
      notificationSocket.connect(token)
    })

    return () => {
      active = false
      notificationSocket.disconnect()
    }
  }, [isSignedIn, setNotifStatus, incrementUnread])

  return null
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <SentryErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.flex}>
          <SafeAreaProvider>
            <NativeAuthInit />
            <GamificationCelebrationHost />
            <Slot />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SentryErrorBoundary>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
