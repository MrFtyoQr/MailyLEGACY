/**
 * app/_layout.tsx
 * ---------------
 * Root layout de Expo Router.
 * Orden de providers (outer → inner):
 *   1. Sentry ErrorBoundary
 *   2. ClerkProvider
 *   3. QueryClientProvider
 *   4. GestureHandlerRootView
 *   5. SafeAreaProvider
 *   6. NotificationSocketInit (conecta WS cuando hay sesión)
 *   7. <Slot />
 */

import 'react-native-gesture-handler'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import * as SecureStore from 'expo-secure-store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot, SplashScreen } from 'expo-router'
import { StyleSheet } from 'react-native'

import { initSentry, SentryErrorBoundary } from '@lib/sentry'
import * as Sentry from '@sentry/react-native'
import { setTokenGetter } from '@lib/api/client'
import { notificationSocket } from '@lib/ws/NotificationSocket'
import { useWsStore } from '@store/ws.store'
import { useAuthStore } from '@store/auth.store'
import { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY } from '@constants/config'

// Inicializar Sentry lo antes posible
initSentry()

// Evento de prueba para confirmar que Sentry recibe eventos
// (solo en desarrollo, aparece en Issues → no en Logs)
if (__DEV__) {
  Sentry.captureMessage('MailyT-Cuida: Sentry inicializado correctamente', 'info')
}

// Mantener el splash nativo hasta que estemos listos
SplashScreen.preventAutoHideAsync()

// QueryClient singleton con retry strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:            1,
      refetchOnWindowFocus: false,
      staleTime:        2 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
})

// SecureStore adapter para Clerk (JWT en almacenamiento seguro)
const tokenCache = {
  async getToken(key: string) {
    try { return await SecureStore.getItemAsync(key) }
    catch { return null }
  },
  async saveToken(key: string, value: string) {
    try { await SecureStore.setItemAsync(key, value) }
    catch { /* silencioso */ }
  },
  async clearToken(key: string) {
    try { await SecureStore.deleteItemAsync(key) }
    catch { /* silencioso */ }
  },
}

// ---------------------------------------------------------------------------
// Sub-componente: conecta WS y Clerk token al cliente axios
// ---------------------------------------------------------------------------

function NotificationSocketInit() {
  const { getToken, isSignedIn } = useAuth()
  const setNotifStatus = useWsStore((s) => s.setNotifStatus)
  const incrementUnread = useWsStore((s) => s.incrementUnread)
  const setSignedIn    = useAuthStore((s) => s.setSignedIn)
  const setLoaded      = useAuthStore((s) => s.setLoaded)

  useEffect(() => {
    // Sincronizar estado de auth con Zustand
    setSignedIn(!!isSignedIn)
    setLoaded(true)

    // Inyectar getter de token en axios
    setTokenGetter(() => getToken())
  }, [isSignedIn, getToken, setSignedIn, setLoaded])

  useEffect(() => {
    if (!isSignedIn) {
      notificationSocket.disconnect()
      return
    }

    // Conectar WS con token fresco de Clerk
    let active = true
    getToken().then((token) => {
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
  }, [isSignedIn, getToken, setNotifStatus, incrementUnread])

  return null
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <SentryErrorBoundary>
      <ClerkProvider
        publishableKey={EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
        tokenCache={tokenCache}
      >
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.flex}>
            <SafeAreaProvider>
              <NotificationSocketInit />
              <Slot />
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ClerkProvider>
    </SentryErrorBoundary>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
